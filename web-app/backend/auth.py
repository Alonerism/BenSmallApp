"""
Authentication module - Simple user management with admin approval.
"""
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from functools import wraps

from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# In-memory session store (for simplicity - Supabase will store users)
_sessions: Dict[str, Dict] = {}

# Session duration
SESSION_HOURS = 24 * 7  # 1 week

security = HTTPBearer(auto_error=False)


class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    approved: bool
    created_at: str


def hash_password(password: str) -> str:
    """Hash password with salt."""
    salt = "payroll_master_salt_2024"  # Simple salt
    return hashlib.sha256(f"{salt}{password.lower()}".encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash (case insensitive)."""
    return hash_password(password.lower()) == hashed


def create_session(user_id: int, username: str, role: str) -> str:
    """Create a session token."""
    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(hours=SESSION_HOURS)
    }
    return token


def get_session(token: str) -> Optional[Dict]:
    """Get session by token."""
    session = _sessions.get(token)
    if session and session["expires_at"] > datetime.now():
        return session
    elif session:
        del _sessions[token]
    return None


def delete_session(token: str):
    """Delete a session."""
    if token in _sessions:
        del _sessions[token]


def delete_user_sessions(user_id: int):
    """Delete all sessions for a user (when kicked)."""
    tokens_to_delete = [
        token for token, data in _sessions.items()
        if data["user_id"] == user_id
    ]
    for token in tokens_to_delete:
        del _sessions[token]


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[Dict]:
    """Get current user from session token."""
    if not credentials:
        return None

    session = get_session(credentials.credentials)
    return session


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """Require authentication."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    session = get_session(credentials.credentials)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session"
        )

    return session


async def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """Require admin role."""
    session = await require_auth(credentials)

    if session.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return session


# =============================================================================
# User Management (uses Supabase)
# =============================================================================

async def init_admin_user(client) -> bool:
    """Initialize the admin user (gilad) if not exists."""
    if not client:
        return False

    try:
        # Check if admin exists
        result = client.table("users").select("*").eq("username", "gilad").execute()

        if not result.data:
            # Create admin user
            client.table("users").insert({
                "username": "gilad",
                "password_hash": hash_password("gilad"),
                "role": "admin",
                "approved": True,
                "created_at": datetime.now().isoformat()
            }).execute()
            print("Admin user 'gilad' created")

        return True
    except Exception as e:
        print(f"Error initializing admin: {e}")
        return False


async def authenticate_user(client, username: str, password: str) -> Optional[Dict]:
    """Authenticate a user."""
    if not client:
        return None

    try:
        # Case insensitive username lookup
        result = client.table("users").select("*").ilike("username", username).execute()

        if result.data:
            user = result.data[0]
            if verify_password(password, user["password_hash"]):
                if not user["approved"]:
                    return {"error": "Account pending approval"}
                return user

        return None
    except Exception as e:
        print(f"Auth error: {e}")
        return None


async def create_user(client, username: str, password: str) -> Dict[str, Any]:
    """Create a new user (pending approval)."""
    if not client:
        return {"error": "Database not configured", "success": False}

    try:
        # Check if username exists (case insensitive)
        existing = client.table("users").select("*").ilike("username", username).execute()

        if existing.data:
            return {"error": "Username already exists", "success": False}

        # Create user (pending approval)
        result = client.table("users").insert({
            "username": username.lower(),
            "password_hash": hash_password(password),
            "role": "user",
            "approved": False,
            "created_at": datetime.now().isoformat()
        }).execute()

        return {"success": True, "message": "Account created. Waiting for admin approval."}
    except Exception as e:
        return {"error": str(e), "success": False}


async def list_users(client) -> List[Dict]:
    """List all users (for admin)."""
    if not client:
        return []

    try:
        result = client.table("users").select("id, username, role, approved, created_at").order("created_at", desc=True).execute()
        return result.data or []
    except Exception as e:
        print(f"Error listing users: {e}")
        return []


async def approve_user(client, user_id: int) -> Dict[str, Any]:
    """Approve a user."""
    if not client:
        return {"error": "Database not configured", "success": False}

    try:
        client.table("users").update({"approved": True}).eq("id", user_id).execute()
        return {"success": True}
    except Exception as e:
        return {"error": str(e), "success": False}


async def delete_user(client, user_id: int) -> Dict[str, Any]:
    """Delete/kick a user."""
    if not client:
        return {"error": "Database not configured", "success": False}

    try:
        # Don't allow deleting admin
        user = client.table("users").select("role").eq("id", user_id).single().execute()
        if user.data and user.data.get("role") == "admin":
            return {"error": "Cannot delete admin user", "success": False}

        # Delete user
        client.table("users").delete().eq("id", user_id).execute()

        # Invalidate their sessions
        delete_user_sessions(user_id)

        return {"success": True}
    except Exception as e:
        return {"error": str(e), "success": False}
