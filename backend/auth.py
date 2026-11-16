"""Self-hosted email/password auth: register, login, JWT Bearer sessions."""

from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

TOKEN_TTL_DAYS = 7
TOKEN_ALG = "HS256"
MIN_PASSWORD_LEN = 8

auth_router = APIRouter(prefix="/api/auth")

_db: Any = None
_env: str = "live"
_default_role: str = "pending"
_now_iso = None
_audit = None


def bind_auth(*, db, env: str, default_role: str, now_iso, audit) -> None:
    """Wire Mongo + helpers from server startup (avoids circular imports)."""
    global _db, _env, _default_role, _now_iso, _audit
    _db = db
    _env = env
    _default_role = default_role
    _now_iso = now_iso
    _audit = audit


def _jwt_secret() -> str:
    secret = os.environ.get("AUTH_JWT_SECRET", "").strip()
    if not secret or "replace_me" in secret.lower() or "changeme" in secret.lower() or len(secret) < 16:
        raise HTTPException(
            status_code=503,
            detail="AUTH_JWT_SECRET is not configured. Set a long random secret in backend/.env",
        )
    return secret


def admin_emails() -> set[str]:
    return {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(*, user_id: str) -> tuple[str, str]:
    sid = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "sid": sid,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=TOKEN_TTL_DAYS)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=TOKEN_ALG), sid


def verify_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[TOKEN_ALG], leeway=5)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")


def require_user(request: Request) -> dict:
    """FastAPI dependency: signed-in user from Authorization: Bearer JWT."""
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not token or token == "local-dev":
        raise HTTPException(status_code=401, detail="Not signed in")
    claims = verify_access_token(token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return {"user_id": user_id, "session_id": claims.get("sid"), "claims": claims}


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LEN:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LEN} characters")


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_email(email: str) -> str:
    email = _normalize_email(email)
    if not email or not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Valid email is required")
    return email


class RegisterIn(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: str
    role: str


def _role_for_email(email: str) -> str:
    return "admin" if email in admin_emails() else _default_role


async def _token_response(user: dict) -> dict:
    token, _sid = create_access_token(user_id=user["user_id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["user_id"],
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "role": user.get("role", _default_role),
    }


@auth_router.get("/config")
def auth_config():
    return {"enabled": True, "local_mode": False, "provider": "local"}


@auth_router.post("/register")
async def register(body: RegisterIn):
    email = _validate_email(body.email)
    _validate_password(body.password)
    name = (body.name or "").strip() or email.split("@")[0]
    if await _db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user_id = str(uuid.uuid4())
    role = _role_for_email(email)
    doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "password_hash": hash_password(body.password),
        "role": role,
        "range": None,
        "created_at": _now_iso(),
        "env": _env,
    }
    await _db.users.insert_one(doc)
    if _audit:
        await _audit("register", {"user_id": user_id, "email": email, "role": role}, {"role": role})
    return await _token_response(doc)


@auth_router.post("/login")
async def login(body: LoginIn):
    email = _validate_email(body.email)
    user = await _db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return await _token_response(user)


@auth_router.post("/logout")
async def logout(request: Request):
    # Stateless JWT: client drops the token. Audit when we can identify the session.
    try:
        user = require_user(request)
        member = await _db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if _audit and member:
            await _audit("logout", member, {}, session_id=user.get("session_id"))
    except HTTPException:
        pass
    return {"ok": True}


async def bootstrap_admin() -> Optional[str]:
    """Ensure ADMIN_EMAIL exists with a password so Docker/local can sign in."""
    password = os.environ.get("ADMIN_PASSWORD", "").strip()
    emails = list(admin_emails())
    if not password or not emails:
        return None
    if "replace_me" in password.lower() or "changeme" in password.lower():
        return None
    email = emails[0]
    existing = await _db.users.find_one({"email": email})
    if existing:
        updates = {"role": "admin", "env": _env}
        if not existing.get("password_hash"):
            updates["password_hash"] = hash_password(password)
        await _db.users.update_one({"user_id": existing["user_id"]}, {"$set": updates})
        return existing["user_id"]
    user_id = str(uuid.uuid4())
    await _db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": "Administrator",
        "password_hash": hash_password(password),
        "role": "admin",
        "range": None,
        "created_at": _now_iso(),
        "env": _env,
    })
    return user_id
