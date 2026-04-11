import jwt
import hashlib
import secrets
import os
from datetime import datetime, timedelta
from database import get_db

SECRET_KEY = os.environ.get('SECRET_KEY', 'chantier360-dev-secret-key')

# ─── Password ────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split(':')
        return hashlib.sha256((password + salt).encode()).hexdigest() == hashed
    except Exception:
        return False

# ─── JWT ─────────────────────────────────────────────────────────────────────

def generate_token(user_id: int, entreprise_id: int, email: str) -> str:
    payload = {
        'user_id': user_id,
        'entreprise_id': entreprise_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# ─── OTP ─────────────────────────────────────────────────────────────────────

def generate_otp(email: str, otp_type: str) -> str:
    """Generate a 6-digit OTP and store in DB. Returns the code."""
    code = str(secrets.randbelow(900000) + 100000)  # 100000-999999
    expire_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()

    conn = get_db()
    # Invalidate old OTPs of same type for this email
    conn.execute(
        "UPDATE otp_tokens SET utilise=1 WHERE email=? AND type=? AND utilise=0",
        (email, otp_type)
    )
    conn.execute(
        "INSERT INTO otp_tokens (email, code, type, expire_at) VALUES (?, ?, ?, ?)",
        (email, code, otp_type, expire_at)
    )
    conn.commit()
    conn.close()
    return code

def verify_otp(email: str, code: str, otp_type: str) -> bool:
    """Verify OTP. Returns True if valid, marks as used."""
    conn = get_db()
    row = conn.execute(
        """SELECT id, expire_at FROM otp_tokens 
           WHERE email=? AND code=? AND type=? AND utilise=0
           ORDER BY created_at DESC LIMIT 1""",
        (email, code, otp_type)
    ).fetchone()

    if not row:
        conn.close()
        return False

    # Check expiry
    expire_at = datetime.fromisoformat(row['expire_at'])
    if datetime.utcnow() > expire_at:
        conn.close()
        return False

    # Mark as used
    conn.execute("UPDATE otp_tokens SET utilise=1 WHERE id=?", (row['id'],))
    conn.commit()
    conn.close()
    return True

# ─── Middleware decorator ────────────────────────────────────────────────────

from functools import wraps
from flask import request, jsonify

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Token manquant'}), 401
        token = auth_header.split(' ')[1]
        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Token invalide ou expiré'}), 401
        request.user = payload
        return f(*args, **kwargs)
    return decorated
