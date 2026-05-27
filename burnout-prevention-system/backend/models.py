"""
COGNITIVE GUARD — User Model
SQLAlchemy ORM with Flask-Bcrypt password hashing.
"""
import uuid
import re
from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

db = SQLAlchemy()
bcrypt = Bcrypt()


class User(db.Model):
    """User model — stores credentials & work-profile information."""

    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(20), nullable=True)
    target_hours = db.Column(db.Float, default=40.0)
    avg_sleep = db.Column(db.String(20), default='Average')
    work_start_time = db.Column(db.String(5), default='09:00')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # ── Password helpers ──────────────────────────────────────

    def set_password(self, password):
        """Hash and store the password using Flask-Bcrypt."""
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        """Verify a plain-text password against the stored hash."""
        return bcrypt.check_password_hash(self.password_hash, password)

    # ── Serialisation ─────────────────────────────────────────

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'phone_number': self.phone_number,
            'target_hours': self.target_hours,
            'avg_sleep': self.avg_sleep,
            'work_start_time': self.work_start_time,
        }

    def __repr__(self):
        return f'<User {self.username}>'

    # ── Static validators ─────────────────────────────────────

    @staticmethod
    def validate_email(email):
        """Basic RFC-style check."""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    @staticmethod
    def validate_password(password):
        """
        Enforce password strength:
        - 8+ characters
        - At least 1 symbol (!@#$%^&* etc.)
        Returns (is_valid: bool, message: str).
        """
        if len(password) < 8:
            return False, 'Password must be at least 8 characters long.'
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', password):
            return False, 'Password must contain at least one special character (!@#$%^&* etc.).'
        return True, 'OK'


class DailyRoutine(db.Model):
    """Stores per-user, per-date schedule as JSON."""

    __tablename__ = 'daily_routines'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.String(10), nullable=False)
    routine_json = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'date', name='uq_user_date'),
    )
