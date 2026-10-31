import base64
import hashlib
import hmac
import secrets
from datetime import timedelta
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from app.config import settings
from app.database.models import User, Permission, AuditEvent, now
from app.database.session import db_session


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600000)
    return base64.b64encode(salt + digest).decode()


def verify_password(password, stored):
    data = base64.b64decode(stored)
    return hmac.compare_digest(data[16:], hashlib.pbkdf2_hmac("sha256", password.encode(), data[:16], 600000))


def session_token(user):
    return jwt.encode(
        {"sub": user.id, "exp": now() + timedelta(hours=8)},
        settings().auth_secret.get_secret_value(),
        algorithm="HS256",
    )


def current_user(request: Request, db=Depends(db_session)):
    try:
        claims = jwt.decode(
            request.cookies.get("humain_session", ""), settings().auth_secret.get_secret_value(), algorithms=["HS256"]
        )
        user = db.get(User, claims["sub"])
        if not user or not user.active:
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Sign in to your local workspace")


def authorize(db, user, permission):
    if not db.scalar(select(Permission).where(Permission.role_id == user.role_id, Permission.code == permission)):
        db.add(AuditEvent(actor_id=user.id, action="permission.denied", detail={"permission": permission}))
        db.commit()
        raise HTTPException(403, f"Permission required: {permission}")


def require(permission):
    def check(user=Depends(current_user), db=Depends(db_session)):
        authorize(db, user, permission)
        return user

    return check
