from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import joblib
import pandas as pd
import numpy as np
import warnings
import io
import os
from typing import Optional

warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

app = FastAPI(title="Voltiq API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load Models ────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

xgb_model = joblib.load(os.path.join(BASE_DIR, "xgboost_model.pkl"))
abnormal_model = joblib.load(os.path.join(BASE_DIR, "abnormal_model.pkl"))

FEATURES = ["Voltage", "Current", "Power", "PowerFactor",
            "EnergyConsumed", "ApparentPower", "PrevHourAvgPower"]

# ─── In-memory Users DB ──────────────────────────────────────────────────────
USERS = {
    "user1@voltiq.io":  {"password": "user123", "role": "user",  "name": "Alice Johnson",  "user_id": "U0018"},
    "user2@voltiq.io":  {"password": "user123", "role": "user",  "name": "Bob Patel",      "user_id": "U0021"},
    "user3@voltiq.io":  {"password": "user123", "role": "user",  "name": "Carlos Mendes",  "user_id": "U0030"},
    "admin@voltiq.io":  {"password": "admin123","role": "admin", "name": "David Chen",     "user_id": None},
}

# ─── Last uploaded results cache (in-memory) ─────────────────────────────────
latest_results = {}   # user_id -> result dict
latest_raw     = {}   # user_id -> list of row dicts (for charts)

# ─── Helpers ─────────────────────────────────────────────────────────────────
def analyze_user_data(df: pd.DataFrame) -> dict:
    X = df[FEATURES]
    theft_probs = xgb_model.predict_proba(X)[:, 1]
    avg_theft_risk = float(theft_probs.mean())
    theft_detected = avg_theft_risk > 0.75

    try:
        anomaly_preds = abnormal_model.predict(X)
        abnormal_count = int((anomaly_preds == -1).sum())
        abnormal_ratio = float(abnormal_count / len(anomaly_preds))
        abnormal_detected = abnormal_ratio > 0.20
    except Exception:
        abnormal_count = 0
        abnormal_ratio = 0.0
        abnormal_detected = False

    row_risks = [round(float(p), 4) for p in theft_probs]

    return {
        "avg_theft_risk":    round(avg_theft_risk, 4),
        "theft_detected":    theft_detected,
        "abnormal_ratio":    round(abnormal_ratio, 4),
        "abnormal_detected": abnormal_detected,
        "total_records":     len(df),
        "abnormal_count":    abnormal_count,
        "row_risks":         row_risks,
        "avg_voltage":       round(float(df["Voltage"].mean()), 2),
        "avg_current":       round(float(df["Current"].mean()), 2),
        "avg_power":         round(float(df["Power"].mean()), 2),
        "avg_power_factor":  round(float(df["PowerFactor"].mean()), 4),
        "total_energy":      round(float(df["EnergyConsumed"].sum()), 2),
    }


# ─── Auth ────────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
async def login(body: dict):
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    role = body.get("role", "")

    user = USERS.get(email)
    if not user or user["password"] != password or user["role"] != role:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "ok":     True,
        "name":   user["name"],
        "email":  email,
        "role":   user["role"],
        "user_id": user["user_id"],
    }


# ─── Default CSV results (from bundled power_data.csv) ───────────────────────
@app.get("/api/results/default")
async def get_default_results():
    """Returns analysis of the bundled power_data.csv split by CustomerID."""
    df = pd.read_csv(os.path.join(BASE_DIR, "power_data.csv"))
    df.columns = df.columns.str.strip()
    grouped = df.groupby("CustomerID")

    results = {}
    for cid, udf in grouped:
        res = analyze_user_data(udf.reset_index(drop=True))
        raw_rows = udf[FEATURES + ["EnergyConsumed"]].to_dict(orient="records")
        res["raw"] = raw_rows
        results[cid] = res

    return results


# ─── Per-user result (uses latest uploaded or default) ───────────────────────
@app.get("/api/results/user/{user_id}")
async def get_user_results(user_id: str):
    if user_id in latest_results:
        return latest_results[user_id]
    # Fall back to default CSV
    df = pd.read_csv(os.path.join(BASE_DIR, "power_data.csv"))
    df.columns = df.columns.str.strip()
    udf = df[df["CustomerID"] == user_id]
    if udf.empty:
        raise HTTPException(status_code=404, detail=f"No data for user {user_id}")
    res = analyze_user_data(udf.reset_index(drop=True))
    res["raw"] = udf[FEATURES].to_dict(orient="records")
    return res


# ─── Admin CSV Upload ─────────────────────────────────────────────────────────
@app.post("/api/admin/upload")
async def admin_upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files accepted")

    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    df.columns = df.columns.str.strip()

    missing = [c for c in ["CustomerID"] + FEATURES if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")

    grouped = df.groupby("CustomerID")
    all_results = {}
    for cid, udf in grouped:
        res = analyze_user_data(udf.reset_index(drop=True))
        res["raw"] = udf[FEATURES].to_dict(orient="records")
        all_results[str(cid)] = res
        latest_results[str(cid)] = res   # cache for per-user endpoint

    return {
        "ok":          True,
        "filename":    file.filename,
        "total_rows":  len(df),
        "users_found": list(all_results.keys()),
        "results":     all_results,
    }


# ─── System stats (admin overview) ───────────────────────────────────────────
@app.get("/api/admin/stats")
async def admin_stats():
    df = pd.read_csv(os.path.join(BASE_DIR, "power_data.csv"))
    df.columns = df.columns.str.strip()
    grouped = df.groupby("CustomerID")

    user_summaries = []
    theft_count = 0
    for cid, udf in grouped:
        res = analyze_user_data(udf.reset_index(drop=True))
        if res["theft_detected"]:
            theft_count += 1
        user_summaries.append({
            "user_id":        cid,
            "records":        len(udf),
            "avg_theft_risk": res["avg_theft_risk"],
            "theft_detected": res["theft_detected"],
            "abnormal_ratio": res["abnormal_ratio"],
            "total_energy":   res["total_energy"],
            "status":         "⚠️ Suspicious" if res["theft_detected"] else "✅ Normal",
        })

    return {
        "total_users":   len(user_summaries),
        "theft_alerts":  theft_count,
        "normal_users":  len(user_summaries) - theft_count,
        "users":         user_summaries,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "models": ["xgboost", "isolation_forest"]}
