# ⚡ Voltiq — AI-Powered Electricity Monitoring & Theft Detection

## Project Structure
```
voltiq/
├── backend/
│   ├── main.py              # FastAPI backend (all API routes)
│   ├── requirements.txt     # Python dependencies
│   ├── xgboost_model.pkl    # XGBoost theft detection model
│   ├── abnormal_model.pkl   # IsolationForest anomaly model
│   └── power_data.csv       # Default dataset (3 users: U0018, U0021, U0030)
│
└── frontend/
    ├── login.html           # ✅ Proper login page with role tabs + demo quickfill
    ├── user-dashboard.html  # ✅ User view — ML results, charts, alerts (NO upload)
    └── admin-dashboard.html # ✅ Admin view — CSV upload, all users, dynamic viz
```

---

## Setup & Run

### 1. Install Python dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Start FastAPI backend
```bash
cd backend
uvicorn main:app --reload --port 8000
```
API will be live at `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

### 3. Open the frontend
Just open `frontend/login.html` in your browser.
*(No build step needed — pure HTML/CSS/JS)*

---

## Login Credentials

| Role  | Email                | Password | User ID |
|-------|----------------------|----------|---------|
| User  | user1@voltiq.io      | user123  | U0018   |
| User  | user2@voltiq.io      | user123  | U0021   |
| User  | user3@voltiq.io      | user123  | U0030   |
| Admin | admin@voltiq.io      | admin123 | —       |

---

## Features

### ✅ Change 1 — Proper Login Page
- Role selector tabs (User / Admin) instead of dropdown
- Click-to-autofill demo credential cards
- Offline fallback if backend is down
- Redirects to correct dashboard based on role

### ✅ Change 2 — Upload moved to Admin Dashboard only
- User Dashboard: shows only own ML results, usage charts, alerts
- Admin Dashboard: has full CSV upload section with format guide

### ✅ Change 3 — Dynamic visualizations update on upload
- When admin uploads CSV, charts refresh instantly with new results
- Per-user result cards show risk score, energy, anomalies
- Overview charts (Risk by User, Energy by User) update automatically

### ✅ Change 4 — 3 Users (U0018, U0021, U0030) mapped to login accounts
- Each user sees only their own data when logged in
- Admin sees all 3 users and can upload new data for all

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (returns role + user_id) |
| GET  | `/api/results/default` | Get ML results for all users in default CSV |
| GET  | `/api/results/user/{user_id}` | Get ML result for specific user |
| POST | `/api/admin/upload` | Upload new CSV, run ML, return results |
| GET  | `/api/admin/stats` | Get admin overview stats |
| GET  | `/api/health` | Health check |

---

## ML Models

### XGBoost — Theft Detection
- Input features: Voltage, Current, Power, PowerFactor, EnergyConsumed, ApparentPower, PrevHourAvgPower
- Output: Probability of theft per row → averaged → flagged if > 75%

### IsolationForest — Anomaly Detection  
- Same features, detects statistical outliers
- Returns -1 (anomaly) or 1 (normal) per row
- Alert if anomaly ratio > 20%

---

## Offline Mode
Both dashboards include offline fallback data, so the UI works even without the backend running. When the backend is live, all data comes from real ML model inference.
