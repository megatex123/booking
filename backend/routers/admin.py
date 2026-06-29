from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from core.database import get_db
from core.feature_flags import ensure_defaults, get_merged_flags, DEFAULT_FLAGS
from middleware.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Global feature flags ──────────────────────────────────────────────────────

@router.get("/flags")
async def get_flags(db=Depends(get_db)):
    """Public — returns global flag state (no per-user overrides)."""
    await ensure_defaults(db)
    return await db.feature_flags.find({}, {"_id": 0}).sort("group", 1).to_list(100)


class FlagUpdate(BaseModel):
    enabled: bool


@router.patch("/flags/{key}")
async def update_flag(key: str, body: FlagUpdate, db=Depends(get_db), _=Depends(require_admin)):
    result = await db.feature_flags.update_one(
        {"key": key},
        {"$set": {"enabled": body.enabled, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Flag not found")
    return await db.feature_flags.find_one({"key": key}, {"_id": 0})


# ── Per-user flag overrides ───────────────────────────────────────────────────

@router.get("/users/{user_id}/flags")
async def get_user_flags(user_id: str, db=Depends(get_db), _=Depends(require_admin)):
    """Returns all flags for a user with per-user overrides applied."""
    return await get_merged_flags(db, user_id)


class UserFlagUpdate(BaseModel):
    enabled: Optional[bool] = None  # null → remove override, bool → set override


@router.patch("/users/{user_id}/flags/{key}")
async def update_user_flag(
    user_id: str,
    key: str,
    body: UserFlagUpdate,
    db=Depends(get_db),
    _=Depends(require_admin),
):
    valid_keys = {f["key"] for f in DEFAULT_FLAGS}
    if key not in valid_keys:
        raise HTTPException(status_code=404, detail="Flag not found")

    if body.enabled is None:
        await db.user_feature_overrides.delete_one({"user_id": user_id, "feature_key": key})
    else:
        await db.user_feature_overrides.update_one(
            {"user_id": user_id, "feature_key": key},
            {
                "$set": {"enabled": body.enabled, "updated_at": datetime.utcnow()},
                "$setOnInsert": {"user_id": user_id, "feature_key": key, "created_at": datetime.utcnow()},
            },
            upsert=True,
        )

    return await get_merged_flags(db, user_id)


# ── Admin stats & users ───────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(db=Depends(get_db), _=Depends(require_admin)):
    customers       = await db.users.count_documents({"role": "customer"})
    vendors         = await db.users.count_documents({"role": "workshop"})
    bookings        = await db.bookings.count_documents({})
    active_bookings = await db.bookings.count_documents({"status": {"$in": ["pending", "confirmed", "in_progress"]}})
    workshops       = await db.workshops.count_documents({})
    queue_today     = await db.queue_waitlist.count_documents({
        "joined_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)},
    })
    return {
        "customers": customers,
        "vendors": vendors,
        "bookings": bookings,
        "active_bookings": active_bookings,
        "workshops": workshops,
        "queue_today": queue_today,
    }


@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(require_admin),
):
    query: dict = {"role": {"$ne": "admin"}}
    if role:
        query["role"] = role
    users = await db.users.find(query, {"password": 0, "password_hash": 0}).to_list(500)
    return [_serialize_user(u) for u in users]


def _serialize_user(u: dict) -> dict:
    u["id"] = str(u["_id"])
    del u["_id"]
    if isinstance(u.get("created_at"), datetime):
        u["created_at"] = u["created_at"].isoformat()
    return u
