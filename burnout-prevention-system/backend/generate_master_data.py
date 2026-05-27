import pandas as pd
import numpy as np
import os

def generate_data(num_rows=15000):
    np.random.seed(42)
    
    # Features
    hours = np.random.randint(20, 81, size=num_rows)  # 20 to 80 hours
    mental_health = np.random.randint(0, 2, size=num_rows)  # 0: No, 1: Yes
    balance = np.random.randint(0, 4, size=num_rows)  # 0: Poor, 1: Fair, 2: Good, 3: Excellent
    isolation = np.random.randint(0, 4, size=num_rows)  # 0: Low, 1: Moderate, 2: High, 3: Very High
    sleep = np.random.randint(5, 10, size=num_rows)  # Sleep hours: 5 to 9
    
    data = pd.DataFrame({
        'Hours_Worked_Per_Week': hours,
        'Access_to_Mental_Health_Resources': mental_health,
        'Work_Life_Balance_Rating': balance,
        'Social_Isolation_Rating': isolation,
        'Sleep_Quality': sleep 
    })
    
    # REFINED MATHEMATICAL FORMULA (Protocol 12.0)
    # Risk = (Hours * 1.4) + (Isolation * 8) - (WLB * 6) - (Sleep * 12)
    
    risk_score = (hours * 1.4) + (isolation * 8) - (balance * 6) - (sleep * 12)
    data['Risk_Score_Raw'] = risk_score
    
    # High Risk threshold (e.g., > -10 based on formula spread)
    # 59 hours + 0 WLB + 2 Isolation + 6 Sleep = (59*1.4) + (2*8) - (0*6) - (6*12) = 82.6 + 16 - 72 = 26.6 (High)
    # We set threshold at -5 to ensure 59 hours + Low WLB hits High Risk easily.
    threshold = -5
    
    data['Burnout_Risk'] = (risk_score > threshold).astype(int)
    
    # Mandatory Constraint: 59 hours + Low WLB (0 or 1) results in High Risk
    floor_mask = (hours >= 59) & (balance <= 1)
    data.loc[floor_mask, 'Burnout_Risk'] = 1
    
    # Path
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    
    FILE_PATH = os.path.join(DATA_DIR, 'Master_Training_Data.csv')
    data.to_csv(FILE_PATH, index=False)
    print(f"Generated 15,000 rows with COGNITIVE GUARD Logic (v12.0) in {FILE_PATH}")

if __name__ == "__main__":
    generate_data()
