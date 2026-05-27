"""
COGNITIVE GUARD — JWT Middleware
@token_required decorator for protecting endpoints.
"""
import os
from functools import wraps

import jwt
from flask import request, jsonify, current_app

from models import User


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
