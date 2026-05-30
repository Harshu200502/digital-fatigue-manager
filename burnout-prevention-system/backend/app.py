"""
DigiFatigueBeaters Backend

Flask application — JWT-based authentication with Flask-Bcrypt
password hashing and SQLAlchemy ORM persistence.
"""

import os
import json
import datetime
import math

from flask import Flask, request, jsonify
from flask_cors import CORS

from models import db, bcrypt, User, DailyRoutine
from middleware import token_required
from routes.auth import auth_bp

# ──────────────────────────────────────────────────────────────
# APP FACTORY
# ──────────────────────────────────────────────────────────────

def create_app():
    app = Flask(__name__)

    # Config
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'guardian-jwt-secret-v17-burnout-prevention-2026-secure-key!')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URI',
        'sqlite:///' + os.path.abspath(os.path.join(os.path.dirname(__file__), 'burnout.db'))
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # CORS
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    FRONTEND_URL_2 = os.environ.get("FRONTEND_URL_2", "http://localhost:5174")

    CORS(app, supports_credentials=True, origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://digital-fatigue-manager.vercel.app",
        "https://digital-fatigue-manager-git-main-harshitha-m-s-proj.vercel.app",
        FRONTEND_URL,
        FRONTEND_URL_2,
    ])

    # Extensions
    db.init_app(app)
    bcrypt.init_app(app)

    # Blueprints
    app.register_blueprint(auth_bp)

    # Create tables
    with app.app_context():
        db.create_all()
        print("[GUARDIAN] Database ready (SQLAlchemy).")

    # ──────────────────────────────────────────────────────────
    # DIGIFATIGUE ENGINE 
    # ──────────────────────────────────────────────────────────

    SLEEP_MAP = {"Poor": 0, "Average": 1, "Good": 2}

    def time_to_mins(t_str):
        h, m = map(int, t_str.split(':'))
        return h * 60 + m

    def mins_to_time(m):
        m = m % (24 * 60)
        h = m // 60
        mm = m % 60
        return f"{h:02d}:{mm:02d}"

    # ── DYNAMIC FATIGUE ALIGNMENT ENGINE v15.0 ──

    def optimize_schedule(routine):
        """
        Tiered break injection based on cognitive fatigue research:
        TIER 1 — Micro-Break (5 min): Work → Work task switch
        TIER 2 — AI Recovery Break (15 min): 90-min cumulative work
        TIER 3 — Deep Focus Window (120 min post-recovery) → Mental Reset (10 min)
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
                'type': 1,
                'title': label,
                'is_injected': True
            })
            pointer += duration
            last_type = 1
            if duration >= 15:
                deep_focus = True
                cumulative_work = 0
            elif duration >= 10:
                deep_focus = False
                cumulative_work = 0

        for i, task in enumerate(routine):
            duration = time_to_mins(task['end']) - time_to_mins(task['start'])
            if duration <= 0:
                continue

            task_id = task.get('id', f'task_{i}')

            if task.get('type') == 1:
                optimized.append({
                    **task,
                    'start': mins_to_time(pointer),
                    'end': mins_to_time(pointer + duration)
                })
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
                available = threshold - cumulative_work
                chunk = min(remaining, available)

                seg_start = pointer
                seg_end = pointer + chunk
                part_counter += 1
                optimized.append({
                    'id': f"{task_id}_part{part_counter}",
                    'start': mins_to_time(seg_start),
                    'end': mins_to_time(seg_end),
                    'type': 0,
                    'title': task.get('title', 'Work')
                })
                pointer = seg_end
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
        """Deterministic heuristic risk score from inputs."""
        if hours < 40:
            score = (hours / 40 * 2) + 1
        elif hours <= 55:
            score = ((hours - 40) / 15 * 2) + 4
        else:
            score = min(10, ((hours - 55) / 25 * 3) + 7)

        if sleep_cat == "Poor":
            score += 2.0
        elif sleep_cat == "Average":
            score += 1.0

        if mh == 'No':
            score += 1.0
        elif mh == 'Yes':
            score -= 0.5

        return min(10, round(score, 1))

    def compute_daily_risk_from_routine(routine):
        """Estimate risk from a day's routine based on total work hours."""
        total_work_mins = 0
        for t in routine:
            if t.get('type') == 0:
                dur = time_to_mins(t['end']) - time_to_mins(t['start'])
                if dur > 0:
                    total_work_mins += dur
        hours = total_work_mins / 60
        return compute_risk(hours)

    # ──────────────────────────────────────────────────────────
    # API ENDPOINTS
    # ──────────────────────────────────────────────────────────

    @app.route('/api/swap-break', methods=['GET'])
    @token_required
    def override_break(current_user):
        import random
        # All available breaks
        exercises = ['Bhramari', 'Box Breathing', 'Physiological Sigh', 'Stretch', 'Tendon', 'Wall Angels']
        return jsonify({
            "status": "success",
            "new_break_title": random.choice(exercises)
        }), 200

    @app.route('/api/schedule', methods=['GET'])
    @token_required
    def schedule_endpoint(current_user):
        """
        Break Logic Engine — returns the user's next predicted break time.
        Used by the frontend notification system to trigger 15-minute alerts.
        Sends Unix epoch timestamps so client/server clocks never mismatch.
        """
        import time as _time
        import calendar

        now = datetime.datetime.utcnow()
        today = now.strftime('%Y-%m-%d')

        # Unix epoch milliseconds for the server's "now"
        server_now_ms = int(calendar.timegm(now.timetuple()) * 1000)

        routine_record = DailyRoutine.query.filter_by(
            user_id=current_user.id, date=today
        ).first()

        routine = json.loads(routine_record.routine_json) if routine_record else []

        now_mins = now.hour * 60 + now.minute

        upcoming_breaks = []
        for task in routine:
            if task.get('type') == 1 and task.get('start'):
                h, m = map(int, task['start'].split(':'))
                start_mins = h * 60 + m
                if start_mins > now_mins:
                    diff_mins = start_mins - now_mins
                    # Compute absolute epoch ms for this break
                    break_dt = now.replace(hour=h, minute=m, second=0, microsecond=0)
                    break_ts_ms = int(calendar.timegm(break_dt.timetuple()) * 1000)

                    upcoming_breaks.append({
                        **task,
                        'minutes_until': diff_mins,
                        'break_timestamp_ms': break_ts_ms,
                    })

        upcoming_breaks.sort(key=lambda x: x['minutes_until'])

        return jsonify({
            'next_break': upcoming_breaks[0] if upcoming_breaks else None,
            'upcoming_breaks': upcoming_breaks[:5],
            'date': today,
            'now': now.strftime('%H:%M'),
            'server_now_ms': server_now_ms,
            'server_tz': 'UTC',
            'user': current_user.username,
        })

    @app.route('/api/next-break', methods=['GET'])
    @token_required
    def next_break_endpoint(current_user):
        """Alias for /api/schedule — backward compatibility."""
        now = datetime.datetime.utcnow()
        today = now.strftime('%Y-%m-%d')

        routine_record = DailyRoutine.query.filter_by(
            user_id=current_user.id, date=today
        ).first()

        routine = json.loads(routine_record.routine_json) if routine_record else []

        now_mins = now.hour * 60 + now.minute

        upcoming_breaks = []
        for task in routine:
            if task.get('type') == 1 and task.get('start'):
                h, m = map(int, task['start'].split(':'))
                start_mins = h * 60 + m
                if start_mins > now_mins:
                    upcoming_breaks.append({
                        **task,
                        'minutes_until': start_mins - now_mins
                    })

        upcoming_breaks.sort(key=lambda x: x['minutes_until'])
        return jsonify({
            'next_break': upcoming_breaks[0] if upcoming_breaks else None,
            'date': today,
            'now': now.strftime('%H:%M')
        })

    @app.route('/api/optimize', methods=['POST'])
    @token_required
    def run_optimization_api(current_user):
        """
        Takes raw work_blocks and automatically injects Recovery Buffers
        using the backend cognitive fatigue predictive model.
        """
        data = request.json
        schedule = data.get('schedule', [])
        
        optimized = optimize_schedule(schedule)
        
        return jsonify({
            "status": "success",
            "optimized_schedule": optimized
        }), 200
    @app.route('/api/predict', methods=['POST'])
    @token_required
    def predict(current_user):
        try:
            data = request.json

            hours = float(data.get('hours_worked', current_user.target_hours))
            sleep_cat = data.get('sleep_quality', current_user.avg_sleep)
            wlb = float(data.get('wlb_rating', 2))
            mh = data.get('mh_resources', 'No')
            routine = data.get('schedule', [])
            optimize = data.get('optimize', False)

            risk_score = compute_risk(hours, sleep_cat, mh, wlb)

            if risk_score > 6.5:
                risk_level = "High"
            elif risk_score >= 4.0:
                risk_level = "Moderate"
            else:
                risk_level = "Healthy"

            print(f"[GUARDIAN] User: {current_user.id} | Score: {risk_score} | Level: {risk_level}")

            response = {
                "user_id": current_user.id,
                "burnout_risk": {
                    "score": risk_score,
                    "level": risk_level,
                    "trend": [
                        {"day": "Mon", "risk": max(0, risk_score - 1.2)},
                        {"day": "Tue", "risk": max(0, risk_score - 0.5)},
                        {"day": "Wed", "risk": risk_score},
                        {"day": "Thu", "risk": min(10, risk_score + 0.3)},
                        {"day": "Fri", "risk": min(10, risk_score + 0.8)}
                    ]
                },
                "engine": "Guardian Secure Engine v17.0 (JWT)",
                "timestamp": datetime.datetime.now().isoformat()
            }

            if optimize:
                response["optimized_routine"] = optimize_schedule(routine)
                response["optimization_triggered"] = True

            return jsonify(response)

        except Exception as e:
            print(f"[ERROR] Guardian Engine: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/routine', methods=['GET'])
    @token_required
    def get_routine_endpoint(current_user):
        """Fetch a routine for a specific date."""
        date = request.args.get('date')
        if not date:
            return jsonify({"error": "date parameter required"}), 400

        record = DailyRoutine.query.filter_by(
            user_id=current_user.id, date=date
        ).first()

        routine = json.loads(record.routine_json) if record else []
        return jsonify({"date": date, "routine": routine})

    @app.route('/api/routine', methods=['POST'])
    @token_required
    def save_routine_endpoint(current_user):
        """Save a routine for a specific date (upsert)."""
        data = request.json
        date = data.get('date')
        schedule = data.get('schedule', [])

        if not date:
            return jsonify({"error": "date required"}), 400

        record = DailyRoutine.query.filter_by(
            user_id=current_user.id, date=date
        ).first()

        if record:
            record.routine_json = json.dumps(schedule)
        else:
            record = DailyRoutine(
                user_id=current_user.id,
                date=date,
                routine_json=json.dumps(schedule)
            )
            db.session.add(record)

        db.session.commit()
        return jsonify({"status": "saved", "date": date})

    @app.route('/api/weekly-trend', methods=['GET'])
    @token_required
    def weekly_trend(current_user):
        """Compute 7-day risk forecast from stored weekly routines."""
        start = request.args.get('start')
        if not start:
            start = datetime.datetime.now().strftime('%Y-%m-%d')

        start_dt = datetime.datetime.strptime(start, '%Y-%m-%d')
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

        dates = [(start_dt + datetime.timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]

        records = DailyRoutine.query.filter(
            DailyRoutine.user_id == current_user.id,
            DailyRoutine.date.in_(dates)
        ).all()

        week_routines = {}
        for rec in records:
            week_routines[rec.date] = json.loads(rec.routine_json)

        trend = []
        for i in range(7):
            d = start_dt + datetime.timedelta(days=i)
            date_str = d.strftime('%Y-%m-%d')
            day_name = day_names[d.weekday()]
            routine = week_routines.get(date_str, [])

            if routine:
                risk = compute_daily_risk_from_routine(routine)
            else:
                risk = 3.0

            total_work = 0
            for t in routine:
                if t.get('type') == 0:
                    dur = time_to_mins(t['end']) - time_to_mins(t['start'])
                    if dur > 0:
                        total_work += dur

            trend.append({
                "day": day_name,
                "date": date_str,
                "risk": risk,
                "work_hours": round(total_work / 60, 1),
                "has_schedule": len(routine) > 0
            })

        return jsonify({"trend": trend, "start": start})

    return app


# ──────────────────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────────────────

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
