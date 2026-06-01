import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score

# Load data
data = pd.read_csv("finalDataset.csv")

# Features & target
X = data.drop('Theft', axis=1)
y = data['Theft']

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, stratify=y, random_state=42)

# Handle imbalance
smote = SMOTE(random_state=42)
X_train_res, y_train_res = smote.fit_resample(X_train, y_train)

# Train XGBoost
weight = len(y_train_res[y_train_res==0])/len(y_train_res[y_train_res==1])
xgb_model = XGBClassifier(use_label_encoder=False, eval_metric='logloss', scale_pos_weight=weight)
xgb_model.fit(X_train_res, y_train_res)

# Evaluate XGBoost
y_pred = xgb_model.predict(X_test)
y_prob = xgb_model.predict_proba(X_test)[:,1]

print("XGBoost ROC-AUC:", roc_auc_score(y_test, y_prob))
print(classification_report(y_test, y_pred))

# Train IsolationForest for abnormal detection
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

abnormal_model = IsolationForest(contamination=0.1, random_state=42)
abnormal_model.fit(X_scaled)

# Save models
joblib.dump(xgb_model, "model/xgboost_model.pkl")
joblib.dump(abnormal_model, "model/abnormal_model.pkl")
joblib.dump(scaler, "model/scaler.pkl")

print("Models saved successfully!")