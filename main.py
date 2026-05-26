"""
COGNITIVE GUARD — Backend Web Service
Flask server, routing, and user session management.
"""
import os
import json
import datetime
import math
import uuid
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash

from models import (
    save_routine, get_routine, get_week_routines,
    get_user_by_username, get_user_by_id, create_user
)
from optimize import optimize_schedule, time_to_mins
from predict import compute_risk, compute_daily_risk_from_routine
from auth import auth_bp

app = Flask(__name__)
app.config['SECRET_KEY'] = 'guardian_secret_key_v16'
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://127.0.0.1:5174"
])

# Register blueprints
app.register_blueprint(auth_bp)

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
