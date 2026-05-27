import numpy as np
import pandas as pd
import os

def generate_burnout_dataset(n_rows=1000):
    np.random.seed(42)
    
    # Generate features
    # meeting_density (0.0 - 1.0)
    meeting_density = np.random.uniform(0.0, 1.0, n_rows)
    
    # after_hours_work (0 - 5 hours)
    after_hours_work = np.random.uniform(0, 5, n_rows)
    
    # digital_support (1 - 5)
    digital_support = np.random.randint(1, 6, n_rows)
    
    # wlb_efficacy (1 - 5)
    wlb_efficacy = np.random.randint(1, 6, n_rows)
    
    # Calculate target logic
    # (density + after_hours/5)
    stress_factor = meeting_density + (after_hours_work / 5)
    
    burnout_risk = []
    for i in range(n_rows):
        if stress_factor[i] > 1.2 and digital_support[i] < 3:
            burnout_risk.append(2) # High
        elif 0.7 <= stress_factor[i] <= 1.2:
            burnout_risk.append(1) # Moderate
        else:
            burnout_risk.append(0) # Low
            
    # Create DataFrame
    df = pd.DataFrame({
        'meeting_density': meeting_density,
        'after_hours_work': after_hours_work,
        'digital_support': digital_support,
        'wlb_efficacy': wlb_efficacy,
        'burnout_risk': burnout_risk
    })
    
    return df

if __name__ == "__main__":
    print("Generating synthetic burnout data...")
    df = generate_burnout_dataset(1000)
    
    # Ensure directory exists
    output_dir = os.path.join('..', 'models')
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    output_path = os.path.join(output_dir, 'synthetic_burnout_data.csv')
    df.to_csv(output_path, index=False)
    
    print(f"Data saved to {output_path}")
    print("\nRisk Level Distribution:")
    print(df['burnout_risk'].value_counts().sort_index())
