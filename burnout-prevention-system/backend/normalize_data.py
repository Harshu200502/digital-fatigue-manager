import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import joblib
import re
import os

print("--- 🚀 Normalization Script: Version 2.0 (Stable) ---")

# 1. Detect Files
survey_csv = 'mental_health_workplace_survey.csv'
custom_xlsx = 'Work Arrangement and Employee Experience Survey.xlsx'

if not os.path.exists(survey_csv) or not os.path.exists(custom_xlsx):
    print("❌ ERROR: Required files missing. Ensure CSV and XLSX are in the same folder.")
    exit()

# 2. Reading Data
print("Reading Data...")
df1_raw = pd.read_csv(survey_csv)
df2_raw = pd.read_excel(custom_xlsx)

# --- LOGIC: Feature Mapping with Realistic 0-10 Scale ---

# Map text burnout from the survey to our 0-1 scale (which we later treat as 0-10)
# Note: 0.5 = Moderate, 0.55+ = Risky
b_map = {
    'Low': 0.2, 
    'Moderate': 0.5, 
    'High': 0.8, 
    'Extremely High': 1.0
}

burnout_values = df2_raw[b_col].map(b_map).fillna(0.5)

df2 = pd.DataFrame({
    'age': df2_raw[a_col].apply(clean_numeric),
    'work_hours': df2_raw[h_col].apply(clean_numeric),
    'stress': burnout_values,
    'sleep': 7.0,
    # APPLYING THE 5.5 (0.55) RULE TO DATASET START:
    'burnout_risk': (burnout_values >= 0.55).astype(int) 
})

# --- LOGIC: The "Magic Fix" ---
# Force everything to numeric just in case Excel snuck a date in
combined = pd.concat([df1, df2], ignore_index=True)
cols = ['age', 'work_hours', 'stress', 'sleep']

for col in cols:
    # This turns any remaining dates/errors into NaN, then fills them with the average
    combined[col] = pd.to_numeric(combined[col], errors='coerce')
    combined[col] = combined[col].fillna(combined[col].mean())

# --- LOGIC: Normalizing ---
print("Normalizing (Scaling to 0-1)...")
scaler = MinMaxScaler()
combined[cols] = scaler.fit_transform(combined[cols])

# 5. Saving
joblib.dump(scaler, 'scaler.pkl')
combined.to_csv('processed_training_data.csv', index=False)

print("\n--- ✅ SUCCESS! ---")
print(f"Total Rows: {len(combined)}")
print("Files Created: 'processed_training_data.csv' and 'scaler.pkl'")