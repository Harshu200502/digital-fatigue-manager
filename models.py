"""
COGNITIVE GUARD — Database & Models Layer
SQLite database operations and connection helpers.
"""
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

# Initialize DB on import
init_db()
