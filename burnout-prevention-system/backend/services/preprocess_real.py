import pandas as pd
import os

def preprocess_real_data(input_path, output_path):
    print(f"Loading data from {input_path}...")
    if not os.path.exists(input_path):
        print(f"Error: File {input_path} not found.")
        return

    df = pd.read_csv(input_path)
    
    # Mapping columns as requested
    # WorkHoursPerWeek -> Workload
    # ManagerSupportScore -> Social Support
    # WorkLifeBalanceScore -> WLB
    
    mapping = {
        'WorkHoursPerWeek': 'workload',
        'ManagerSupportScore': 'social_support',
        'WorkLifeBalanceScore': 'wlb'
    }
    
    # Check if columns exist
    for old_col, new_col in mapping.items():
        if old_col not in df.columns:
            print(f"Warning: Column '{old_col}' not found in dataset.")
    
    # Target columns for normalization
    columns_to_process = list(mapping.keys())
    
    # Add target variable
    if 'BurnoutRisk' in df.columns:
        columns_to_process.append('BurnoutRisk')
    
    # Create final dataframe
    cleaned_df = df[columns_to_process].copy()
    cleaned_df.rename(columns=mapping, inplace=True)
    
    # Normalize to 0-1 scale
    print("Normalizing data...")
    for col in cleaned_df.columns:
        min_val = cleaned_df[col].min()
        max_val = cleaned_df[col].max()
        if max_val != min_val:
            cleaned_df[col] = (cleaned_df[col] - min_val) / (max_val - min_val)
        else:
            cleaned_df[col] = 0.0
            
    # Save cleaned version
    print(f"Saving cleaned data to {output_path}...")
    cleaned_df.to_csv(output_path, index=False)
    print("Preprocessing complete.")
    return cleaned_df

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    INPUT_FILE = os.path.join(BASE_DIR, 'data', 'mental_health_workplace_survey.csv')
    OUTPUT_FILE = os.path.join(BASE_DIR, 'data', 'cleaned_real_dataset.csv')
    
    preprocess_real_data(INPUT_FILE, OUTPUT_FILE)
