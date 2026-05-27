import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

def train_model():
    # Paths
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_PATH = os.path.join(BASE_DIR, 'data', 'Master_Training_Data.csv')
    MODEL_DIR = os.path.join(BASE_DIR, 'models')
    MODEL_PATH = os.path.join(MODEL_DIR, 'burnout_model.pkl')

    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)

    if os.path.exists(DATA_PATH):
        print(f"--- Training Fresh Burnout Model ---")
        df = pd.read_csv(DATA_PATH)
        
        # Specified 5 normalized features
        # 1. Hours_Worked_Per_Week
        # 2. Access_to_Mental_Health_Resources
        # 3. Work_Life_Balance_Rating
        # 4. Social_Isolation_Rating
        # 5. Sleep_Quality
        
        features = [
            'Hours_Worked_Per_Week',
            'Access_to_Mental_Health_Resources',
            'Work_Life_Balance_Rating',
            'Social_Isolation_Rating',
            'Sleep_Quality'
        ]
        
        X = df[features]
        y = df['Burnout_Risk']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        print(f"Training on {len(X_train)} rows...")
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        
        print(f"Model Accuracy: {acc:.4f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))

        # Save the model
        print(f"Saving model to {MODEL_PATH}...")
        joblib.dump(model, MODEL_PATH)
    else:
        print(f"Error: {DATA_PATH} not found. Run generate_master_data.py first.")

if __name__ == "__main__":
    train_model()
