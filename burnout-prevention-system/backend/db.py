import os
import json
import sqlite3
from datetime import datetime, timedelta

# PROTOCOL 16.0 — MULTI-TEMPORAL ALIGNMENT
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'burnout.db'))

def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _migrate_db(conn):
    """Safely add new columns to existing DB without destroying data."""
    c = conn.cursor()
    migrations = [
        ("ALTER TABLE users ADD COLUMN phone TEXT",
         "Added 'phone' column to users."),
        ("ALTER TABLE users ADD COLUMN work_start_time TEXT DEFAULT '09:00'",
         "Added 'work_start_time' column to users."),
    ]
    for sql, msg in migrations:
        try:
            c.execute(sql)
            conn.commit()
            print(f"[GUARDIAN] Migration: {msg}")
        except sqlite3.OperationalError:
            pass  # Column already exists — safe to ignore


def init_db():
    print(f"[GUARDIAN] Initializing Database at: {DB_PATH}")
    conn = _conn()
    c = conn.cursor()

    # Users table — base schema (new installs)
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            target_hours REAL DEFAULT 40.0,
            avg_sleep TEXT DEFAULT 'Average',
            phone TEXT,
            work_start_time TEXT DEFAULT '09:00'
        )
    ''')

    # Analysis history (legacy)
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

    # Daily routines — date-based persistence
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

    # Migrate existing databases (adds columns if missing)
    _migrate_db(conn)

    conn.close()
    print("[GUARDIAN] Database ready.")

def save_routine(user_id, date_str, routine):
    """Upsert a routine for a given date."""
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
    """Fetch a routine for a specific date. Returns list or None."""
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
    """Fetch 7 days of routines starting from start_date."""
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

# Legacy functions
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

# --- User Auth Helpers ---
def get_user_by_username(username):
    conn = _conn()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE username = ?', (username,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_email(email):
    conn = _conn()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE email = ?', (email,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_phone(phone):
    conn = _conn()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE phone = ?', (phone,))
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

def create_user(user_id, username, email, password_hash,
                target_hours, avg_sleep, phone=None, work_start_time='09:00'):
    """Insert a new user. Returns True on success, False on duplicate."""
    conn = _conn()
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO users
                (id, username, email, password_hash, target_hours, avg_sleep, phone, work_start_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, username, email, password_hash,
              target_hours, avg_sleep, phone, work_start_time))
        conn.commit()
        success = True
    except sqlite3.IntegrityError:
        success = False
    conn.close()
    return success

if __name__ == "__main__":
    init_db()
