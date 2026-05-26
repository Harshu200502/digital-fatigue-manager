"""
COGNITIVE GUARD — Auth Routes
/api/register, /api/login, /api/logout, /api/me
JWT-based with Flask-Bcrypt password hashing.
"""
import datetime
from functools import wraps
import jwt
from flask import Blueprint, request, jsonify, current_app

from models import db, User

auth_bp = Blueprint('auth', __name__)


# ── JWT MIDDLEWARE INLINED ───────────────────────────────────────────────────

def token_required(f):
    """
    Decorator that extracts and validates the JWT from the
    Authorization header (Bearer <token>). Injects the resolved
    User object as the first positional argument to the route.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # 1. Check Authorization header
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]

        if not token:
            return jsonify({'error': 'Authentication token is missing.'}), 401

        try:
            secret = current_app.config['SECRET_KEY']
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            user = User.query.get(payload['sub'])
            if user is None:
                return jsonify({'error': 'User not found.'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired. Please log in again.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token. Please log in again.'}), 401

        return f(user, *args, **kwargs)

    return decorated


# ── REGISTER ──────────────────────────────────────────────────────────────────

@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}

    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    phone_number = (data.get('phone_number') or data.get('phone') or '').strip() or None

    # --- Validation ---
    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required.'}), 400

    if not User.validate_email(email):
        return jsonify({'error': 'Invalid email format.'}), 400

    pw_ok, pw_msg = User.validate_password(password)
    if not pw_ok:
        return jsonify({'error': pw_msg}), 400

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'Username or email already exists.'}), 409

    # --- Create user (work profile fields use model defaults) ---
    user = User(
        username=username,
        email=email,
        phone_number=phone_number,
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    token = _issue_token(user)

    return jsonify({
        'message': 'Registered successfully',
        'token': token,
        'user': user.to_dict(),
    }), 201


# ── LOGIN ─────────────────────────────────────────────────────────────────────

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    password = data.get('password', '')
    identifier = (
        data.get('username') or data.get('email') or data.get('identifier') or ''
    ).strip()

    if not identifier or not password:
        return jsonify({'error': 'Please provide credentials.'}), 400

    # Try username first, then email
    user = User.query.filter_by(username=identifier).first()
    if not user and '@' in identifier:
        user = User.query.filter_by(email=identifier.lower()).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials. Check your email/username and password.'}), 401

    token = _issue_token(user)

    return jsonify({
        'message': 'Logged in',
        'token': token,
        'user': user.to_dict(),
    })


# ── LOGOUT ────────────────────────────────────────────────────────────────────

@auth_bp.route('/api/logout', methods=['POST'])
@token_required
def logout(current_user):
    # JWT is stateless — client simply discards the token.
    # This endpoint exists for API-contract compatibility.
    return jsonify({'message': 'Logged out'})


# ── ME (session persistence) ─────────────────────────────────────────────────

@auth_bp.route('/api/me', methods=['GET'])
@token_required
def get_me(current_user):
    return jsonify(current_user.to_dict())


# ── HELPER ────────────────────────────────────────────────────────────────────

def _issue_token(user):
    """Issue a JWT with a 24-hour expiry."""
    payload = {
        'sub': user.id,
        'username': user.username,
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24),
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
