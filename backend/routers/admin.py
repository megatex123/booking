from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from core.database import get_db
from middleware.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

DEFAULT_FLAGS = [
    {"key": "customer_queue_join",      "label": "Queue Join",           "group": "customer", "description": "Customers can join workshop queues remotely"},
    {"key": "customer_vehicle_health",  "label": "Car Health Score",     "group": "customer", "description": "Vehicle health scoring and service reminders"},
    {"key": "customer_service_history", "label": "Service History",      "group": "customer", "description": "Unified service timeline and manual logs"},
    {"key": "customer_loyalty",         "label": "Loyalty Program",      "group": "customer", "description": "Points, tiers, and rewards"},
    {"key": "customer_referral",        "label": "Referral Program",     "group": "customer", "description": "Referral codes and credit rewards"},
    {"key": "customer_compare",         "label": "Compare Workshops",    "group": "customer", "description": "Side-by-side workshop comparison"},
    {"key": "customer_corporate",       "label": "Corporate Accounts",   "group": "customer", "description": "Corporate fleet registration"},
    {"key": "customer_chat",            "label": "In-app Chat",          "group": "customer", "description": "Real-time chat with workshop staff"},
    {"key": "vendor_staff_scheduling",  "label": "Staff Scheduling",     "group": "vendor",   "description": "Roster mechanics by day and shift"},
    {"key": "vendor_queue_management",  "label": "Walk-in Queue",        "group": "vendor",   "description": "Live walk-in queue management"},
    {"key": "vendor_analytics",         "label": "Analytics",            "group": "vendor",   "description": "Revenue charts and insights dashboard"},
    {"key": "vendor_product_inventory", "label": "Product Inventory",    "group": "vendor",   "description": "Spare parts and materials management"},
    {"key": "vendor_workshop_layout",   "label": "Workshop Layout",      "group": "vendor",   "description": "Repair bay assignment and management"},
    {"key": "vendor_customer_crm",      "label": "Customer CRM",         "group": "vendor",   "description": "Past customers and visit history"},
    {"key": "vendor_panel_settings",    "label": "Panel Settings",       "group": "vendor",   "description": "Insurance panel provider configuration"},
    {"key": "vendor_promotions",        "label": "Promotions",           "group": "vendor",   "description": "Flash deals and time-limited offers"},
]


async def require_admin(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def _ensure_defaults(db):
    for flag in DEFAULT_FLAGS:
        await db.feature_flags.update_one(
            {"key": flag["key"]},
            {"$setOnInsert": {**flag, "enabled": True, "created_at": datetime.utcnow()}},
            upsert=True,
        )


@router.get("/flags")
async def get_flags(db=Depends(get_db)):
    """Public endpoint — app fetches this on startup to load feature gate state."""
    await _ensure_defaults(db)
    flags = await db.feature_flags.find({}, {"_id": 0}).sort("group", 1).to_list(100)
    return flags


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
    flag = await db.feature_flags.find_one({"key": key}, {"_id": 0})
    return flag


@router.get("/stats")
async def admin_stats(db=Depends(get_db), _=Depends(require_admin)):
    customers      = await db.users.count_documents({"role": "customer"})
    vendors        = await db.users.count_documents({"role": "workshop"})
    bookings       = await db.bookings.count_documents({})
    active_bookings = await db.bookings.count_documents({"status": {"$in": ["pending", "confirmed", "in_progress"]}})
    workshops      = await db.workshops.count_documents({})
    queue_today    = await db.queue_waitlist.count_documents({"joined_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)}})
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
