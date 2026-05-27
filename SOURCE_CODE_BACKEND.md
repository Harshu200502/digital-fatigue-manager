# Proactive Burnout Prevention System — Backend Source Code

> **Tech Stack**: Python · Flask · SQLite · Scikit-learn · Pandas · Joblib

---

## `backend/requirements.txt`

```
flask==3.1.2
flask-cors==6.0.2
flask-login==0.6.3
scikit-learn==1.8.0
pandas==2.3.3
joblib==1.5.3
numpy==2.4.0
```

---

## `backend/db.py`

```python
import os
import json
import sqlite3
from datetime import datetime, timedelta

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'burnout.db'))

def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    print(f"[GUARDIAN] Initializing Database at: {DB_PATH}")
    conn = _conn()
    c = conn.cursor()

    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            target_hours REAL,
            avg_sleep TEXT
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT,
            hours_worked REAL,
            category_code INTEGER,
            start_time TEXT,
            end_time TEXT,
            mh_resources INTEGER,
            wlb_rating INTEGER,
            isolation_rating INTEGER,
            sleep_quality INTEGER,
            risk_score REAL,
            risk_level TEXT
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS daily_routines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            date TEXT NOT NULL,
            routine_json TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, date)
        )
    ''')

    conn.commit()
    conn.close()
    print("[GUARDIAN] Database ready.")

def save_routine(user_id, date_str, routine):
    conn = _conn()
    c = conn.cursor()
    c.execute('''
        INSERT INTO daily_routines (user_id, date, routine_json, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, date) DO UPDATE SET
            routine_json = excluded.routine_json,
            updated_at = CURRENT_TIMESTAMP
    ''', (user_id, date_str, json.dumps(routine)))
    conn.commit()
    conn.close()

def get_routine(user_id, date_str):
    conn = _conn()
    c = conn.cursor()
    c.execute('SELECT routine_json FROM daily_routines WHERE user_id = ? AND date = ?',
              (user_id, date_str))
    row = c.fetchone()
    conn.close()
    if row:
        return json.loads(row['routine_json'])
    return None

def get_week_routines(user_id, start_date_str):
    start = datetime.strptime(start_date_str, '%Y-%m-%d')
    dates = [(start + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]
    conn = _conn()
    c = conn.cursor()
    placeholders = ','.join('?' for _ in dates)
    c.execute(f'''
        SELECT date, routine_json FROM daily_routines
        WHERE user_id = ? AND date IN ({placeholders})
    ''', [user_id] + dates)
    rows = c.fetchall()
    conn.close()
    result = {}
    for row in rows:
        result[row['date']] = json.loads(row['routine_json'])
    return result

def save_analysis(user_id, hours, category_code, start_time, end_time, mh, wlb, isolation, sleep, risk_score, risk_level):
    conn = _conn()
    c = conn.cursor()
    c.execute('''
        INSERT INTO analysis_history (
            user_id, hours_worked, category_code, start_time, end_time,
            mh_resources, wlb_rating, isolation_rating, sleep_quality,
            risk_score, risk_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, hours, category_code, start_time, end_time, mh, wlb, isolation, sleep, risk_score, risk_level))
    conn.commit()
    conn.close()

def get_history(user_id, days=7):
    conn = _conn()
    c = conn.cursor()
    cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d %H:%M:%S')
    c.execute('''
        SELECT timestamp, risk_score, risk_level, category_code, start_time, end_time
        FROM analysis_history WHERE user_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC
    ''', (user_id, cutoff))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_user_by_username(username):
    conn = _conn()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE username = ?', (username,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_id(user_id):
    conn = _conn()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def create_user(user_id, username, email, password_hash, target_hours, avg_sleep):
    conn = _conn()
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO users (id, username, email, password_hash, target_hours, avg_sleep)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, username, email, password_hash, target_hours, avg_sleep))
        conn.commit()
        success = True
    except sqlite3.IntegrityError:
        success = False
    conn.close()
    return success

if __name__ == "__main__":
    init_db()
```

---

## `backend/app.py`

```python
import os
import json
import datetime
import math
import uuid
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash

from db import (
    init_db, save_routine, get_routine, get_week_routines,
    get_user_by_username, get_user_by_id, create_user
)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'guardian_secret_key_v16'
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://127.0.0.1:5174"
])

login_manager = LoginManager()
login_manager.init_app(app)

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data['id'])
        self.username = user_data['username']
        self.email = user_data['email']
        self.target_hours = user_data.get('target_hours', 40.0)
        self.avg_sleep = user_data.get('avg_sleep', 'Average')

@login_manager.user_loader
def load_user(user_id):
    user_data = get_user_by_id(user_id)
    return User(user_data) if user_data else None

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized"}), 401

SLEEP_MAP = {"Poor": 0, "Average": 1, "Good": 2}

def time_to_mins(t_str):
    h, m = map(int, t_str.split(':'))
    return h * 60 + m

def mins_to_time(m):
    m = m % (24 * 60)
    return f"{m // 60:02d}:{m % 60:02d}"

# ── DYNAMIC FATIGUE ALIGNMENT ENGINE v15.0 ──

def optimize_schedule(routine):
    """
    Tiered break injection (cognitive fatigue model):
      TIER 1 — Micro-Break (5 min): consecutive work → work switch
      TIER 2 — AI Recovery Break (15 min): after 90 min cumulative work
      TIER 3 — Mental Reset (10 min): after 120 min in deep-focus state
    """
    if not routine:
        return []

    optimized = []
    pointer = time_to_mins(routine[0]['start'])
    cumulative_work = 0
    last_type = -1
    deep_focus = False
    part_counter = 0

    def _fatigue_threshold():
        return 120 if deep_focus else 90

    def _inject_break(label, duration, tag):
        nonlocal pointer, part_counter, cumulative_work, deep_focus, last_type
        part_counter += 1
        optimized.append({
            'id': f"break_{tag}_{part_counter}",
            'start': mins_to_time(pointer),
            'end': mins_to_time(pointer + duration),
            'type': 1, 'title': label, 'is_injected': True
        })
        pointer += duration
        last_type = 1
        if duration >= 15:
            deep_focus = True; cumulative_work = 0
        elif duration >= 10:
            deep_focus = False; cumulative_work = 0

    for i, task in enumerate(routine):
        duration = time_to_mins(task['end']) - time_to_mins(task['start'])
        if duration <= 0:
            continue
        task_id = task.get('id', f'task_{i}')

        if task.get('type') == 1:
            optimized.append({**task, 'start': mins_to_time(pointer), 'end': mins_to_time(pointer + duration)})
            pointer += duration
            cumulative_work = 0
            deep_focus = duration >= 15
            last_type = 1
            continue

        if last_type == 0:
            _inject_break('Micro-Break', 5, f'micro_{task_id}')

        remaining = duration
        while remaining > 0:
            threshold = _fatigue_threshold()
            chunk = min(remaining, threshold - cumulative_work)
            part_counter += 1
            optimized.append({
                'id': f"{task_id}_part{part_counter}",
                'start': mins_to_time(pointer),
                'end': mins_to_time(pointer + chunk),
                'type': 0,
                'title': task.get('title', 'Work')
            })
            pointer += chunk
            remaining -= chunk
            cumulative_work += chunk
            last_type = 0
            if cumulative_work >= threshold and remaining > 0:
                if deep_focus:
                    _inject_break('Mental Reset', 10, f'reset_{task_id}')
                else:
                    _inject_break('AI Recovery Break', 15, f'recovery_{task_id}')

    return optimized

# ── DETERMINISTIC RISK CALCULATOR ──

def compute_risk(hours, sleep_cat='Average', mh='No', wlb=2):
    if hours < 40:
        score = (hours / 40 * 2) + 1
    elif hours <= 55:
        score = ((hours - 40) / 15 * 2) + 4
    else:
        score = min(10, ((hours - 55) / 25 * 3) + 7)
    if sleep_cat == "Poor": score += 2.0
    elif sleep_cat == "Average": score += 1.0
    if mh == 'No': score += 1.0
    elif mh == 'Yes': score -= 0.5
    return min(10, round(score, 1))

def compute_daily_risk_from_routine(routine):
    total_work_mins = sum(
        time_to_mins(t['end']) - time_to_mins(t['start'])
        for t in routine if t.get('type') == 0
        and time_to_mins(t['end']) - time_to_mins(t['start']) > 0
    )
    return compute_risk(total_work_mins / 60)

# ── API ENDPOINTS ──

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username, email, password = data.get('username'), data.get('email'), data.get('password')
    target_hours = float(data.get('target_hours', 40.0))
    avg_sleep = data.get('avg_sleep', 'Average')
    if not username or not password or not email:
        return jsonify({"error": "Missing required fields"}), 400
    user_id = str(uuid.uuid4())
    if not create_user(user_id, username, email, generate_password_hash(password), target_hours, avg_sleep):
        return jsonify({"error": "Username or email already exists"}), 409
    login_user(User(get_user_by_id(user_id)))
    return jsonify({"message": "Registered successfully", "user": {
        "id": user_id, "username": username,
        "target_hours": target_hours, "avg_sleep": avg_sleep
    }})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_data = get_user_by_username(data.get('username'))
    if user_data and check_password_hash(user_data['password_hash'], data.get('password')):
        user_obj = User(user_data)
        login_user(user_obj)
        return jsonify({"message": "Logged in", "user": {
            "id": user_obj.id, "username": user_obj.username,
            "target_hours": user_obj.target_hours, "avg_sleep": user_obj.avg_sleep
        }})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out"})

@app.route('/api/me', methods=['GET'])
@login_required
def get_me():
    return jsonify({"id": current_user.id, "username": current_user.username,
                    "target_hours": current_user.target_hours, "avg_sleep": current_user.avg_sleep})

@app.route('/api/predict', methods=['POST'])
@login_required
def predict():
    try:
        data = request.json
        hours      = float(data.get('hours_worked', current_user.target_hours))
        sleep_cat  = data.get('sleep_quality', current_user.avg_sleep)
        wlb        = float(data.get('wlb_rating', 2))
        mh         = data.get('mh_resources', 'No')
        routine    = data.get('schedule', [])
        optimize   = data.get('optimize', False)

        risk_score = compute_risk(hours, sleep_cat, mh, wlb)
        risk_level = "High" if risk_score > 6.5 else ("Moderate" if risk_score >= 4.0 else "Healthy")

        response = {
            "user_id": current_user.id,
            "burnout_risk": {
                "score": risk_score, "level": risk_level,
                "trend": [
                    {"day": "Mon", "risk": max(0, risk_score - 1.2)},
                    {"day": "Tue", "risk": max(0, risk_score - 0.5)},
                    {"day": "Wed", "risk": risk_score},
                    {"day": "Thu", "risk": min(10, risk_score + 0.3)},
                    {"day": "Fri", "risk": min(10, risk_score + 0.8)}
                ]
            },
            "engine": "Guardian Secure Engine v16.0",
            "timestamp": datetime.datetime.now().isoformat()
        }
        if optimize:
            response["optimized_routine"] = optimize_schedule(routine)
            response["optimization_triggered"] = True
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/routine', methods=['GET'])
@login_required
def get_routine_endpoint():
    date = request.args.get('date')
    if not date:
        return jsonify({"error": "date parameter required"}), 400
    return jsonify({"date": date, "routine": get_routine(current_user.id, date) or []})

@app.route('/api/routine', methods=['POST'])
@login_required
def save_routine_endpoint():
    data = request.json
    date = data.get('date')
    if not date:
        return jsonify({"error": "date required"}), 400
    save_routine(current_user.id, date, data.get('schedule', []))
    return jsonify({"status": "saved", "date": date})

@app.route('/api/weekly-trend', methods=['GET'])
@login_required
def weekly_trend():
    start = request.args.get('start') or datetime.datetime.now().strftime('%Y-%m-%d')
    week_routines = get_week_routines(current_user.id, start)
    start_dt = datetime.datetime.strptime(start, '%Y-%m-%d')
    day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    trend = []
    for i in range(7):
        d = start_dt + datetime.timedelta(days=i)
        date_str = d.strftime('%Y-%m-%d')
        routine = week_routines.get(date_str, [])
        risk = compute_daily_risk_from_routine(routine) if routine else 3.0
        total_work = sum(
            time_to_mins(t['end']) - time_to_mins(t['start'])
            for t in routine if t.get('type') == 0
        )
        trend.append({
            "day": day_names[d.weekday()], "date": date_str,
            "risk": risk, "work_hours": round(total_work / 60, 1),
            "has_schedule": len(routine) > 0
        })
    return jsonify({"trend": trend, "start": start})

init_db()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

---

## `backend/services/scheduler_service.py`

```python
from datetime import datetime, timedelta
try:
    from db import get_recent_risk_levels
except ImportError:
    def get_recent_risk_levels(count): return []

INTERVENTION_LIBRARY = {
    'physical':  ['5-min Desk Stretch', 'Eye Rest / 20-20-20 Rule'],
    'social':    ['Drop a thank-you message to a peer', 'Quick 5-min coffee sync'],
    'recovery':  ['Set a hard-stop boundary for 6 PM', '10-min Power Nap/Rest', '🧘 Breathing Exercises'],
    'escalated': ['🛑 RECOMMENDED: Personal Day / Half-Day Off']
}

def analyze_schedule(schedule_data, features):
    """Scans a schedule for gaps and injects context-aware interventions."""
    if not schedule_data:
        return [], "No schedule provided"

    workload       = features.get('workload', 8) / 14.0
    social_support = features.get('social_support', 50) / 100.0

    recent_risks = get_recent_risk_levels(3)
    is_trend_critical = len(recent_risks) >= 3 and all(r in ['Moderate', 'High'] for r in recent_risks)

    if is_trend_critical:
        category = 'escalated'
        reason = "CRITICAL TREND: Persistent high-risk state detected across multiple sessions."
    elif workload > 0.7:
        category = 'physical'
        reason = "DYNAMIC INTERVENTION: Scaling physical recovery due to high intensity workload."
    elif social_support < 0.4:
        category = 'social'
        reason = "CONTEXTUAL SYNC: Prioritizing social connectivity to counter isolation risk."
    else:
        category = 'recovery'
        reason = "PROACTIVE BALANCE: Routine energy preservation protocol."

    interventions = INTERVENTION_LIBRARY[category]
    sorted_schedule = sorted(schedule_data, key=lambda x: x['start'])
    modified_schedule = []

    for i, current_event in enumerate(sorted_schedule):
        modified_schedule.append(current_event)
        if i < len(sorted_schedule) - 1:
            next_event = sorted_schedule[i + 1]
            try:
                current_end = datetime.strptime(current_event['end'], "%H:%M")
                next_start  = datetime.strptime(next_event['start'], "%H:%M")
                gap = next_start - current_end
                threshold = 5 if workload > 0.6 else 15

                if gap >= timedelta(minutes=threshold):
                    duration = max(5, min(15, int(gap.total_seconds() / 120)))
                    exercise_start = current_end + (gap - timedelta(minutes=duration)) / 2
                    exercise_end   = exercise_start + timedelta(minutes=duration)
                    modified_schedule.append({
                        'title': f"{interventions[i % len(interventions)]} (AI Exercise)",
                        'start': exercise_start.strftime("%H:%M"),
                        'end':   exercise_end.strftime("%H:%M"),
                        'type':  'prevention'
                    })
            except Exception as e:
                print(f"Intervention skip on task {i}: {e}")
    return modified_schedule, reason
```

---

## `backend/generate_master_data.py`

```python
import pandas as pd
import numpy as np
import os

def generate_data(num_rows=15000):
    np.random.seed(42)
    hours        = np.random.randint(20, 81, size=num_rows)
    mental_health= np.random.randint(0,  2,  size=num_rows)
    balance      = np.random.randint(0,  4,  size=num_rows)
    isolation    = np.random.randint(0,  4,  size=num_rows)
    sleep        = np.random.randint(5, 10,  size=num_rows)

    data = pd.DataFrame({
        'Hours_Worked_Per_Week':              hours,
        'Access_to_Mental_Health_Resources':  mental_health,
        'Work_Life_Balance_Rating':           balance,
        'Social_Isolation_Rating':            isolation,
        'Sleep_Quality':                      sleep
    })

    # Risk Formula (Protocol 12.0):
    # Risk = (Hours * 1.4) + (Isolation * 8) - (WLB * 6) - (Sleep * 12)
    risk_score = (hours * 1.4) + (isolation * 8) - (balance * 6) - (sleep * 12)
    data['Risk_Score_Raw'] = risk_score
    data['Burnout_Risk'] = (risk_score > -5).astype(int)

    # Mandatory Constraint: 59+ hours AND low WLB → always High Risk
    data.loc[(hours >= 59) & (balance <= 1), 'Burnout_Risk'] = 1

    BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR  = os.path.join(BASE_DIR, 'data')
    os.makedirs(DATA_DIR, exist_ok=True)
    FILE_PATH = os.path.join(DATA_DIR, 'Master_Training_Data.csv')
    data.to_csv(FILE_PATH, index=False)
    print(f"Generated {num_rows} rows → {FILE_PATH}")

if __name__ == "__main__":
    generate_data()
```

---

## `backend/train_model.py`

```python
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

def train_model():
    BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
    DATA_PATH  = os.path.join(BASE_DIR, 'data', 'Master_Training_Data.csv')
    MODEL_DIR  = os.path.join(BASE_DIR, 'models')
    MODEL_PATH = os.path.join(MODEL_DIR, 'burnout_model.pkl')
    os.makedirs(MODEL_DIR, exist_ok=True)

    if not os.path.exists(DATA_PATH):
        print(f"Error: {DATA_PATH} not found. Run generate_master_data.py first.")
        return

    df = pd.read_csv(DATA_PATH)
    features = [
        'Hours_Worked_Per_Week',
        'Access_to_Mental_Health_Resources',
        'Work_Life_Balance_Rating',
        'Social_Isolation_Rating',
        'Sleep_Quality'
    ]
    X, y = df[features], df['Burnout_Risk']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"Training on {len(X_train)} rows...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(classification_report(y_test, y_pred))

    joblib.dump(model, MODEL_PATH)
    print(f"Model saved → {MODEL_PATH}")

if __name__ == "__main__":
    train_model()
```
