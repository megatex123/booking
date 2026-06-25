from fastapi import APIRouter, Depends
from core.database import get_db
from middleware.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def serialize_notif(n: dict) -> dict:
    return {
        "id": n["_id"],
        "type": n.get("type", ""),
        "title": n.get("title", ""),
        "body": n.get("body", ""),
        "data": n.get("data", {}),
        "is_read": n.get("is_read", False),
        "created_at": n["created_at"].isoformat() if hasattr(n.get("created_at"), "isoformat") else str(n.get("created_at", "")),
    }


@router.get("/")
async def get_notifications(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).limit(50)
    notifs = await cursor.to_list(50)
    return [serialize_notif(n) for n in notifs]


@router.get("/unread-count")
async def get_unread_count(user=Depends(get_current_user), db=Depends(get_db)):
    count = await db.notifications.count_documents({"user_id": user["_id"], "is_read": False})
    return {"count": count}


@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await db.notifications.update_one(
        {"_id": notif_id, "user_id": user["_id"]},
        {"$set": {"is_read": True}},
    )
    return {"ok": True}


@router.patch("/read-all")
async def mark_all_read(user=Depends(get_current_user), db=Depends(get_db)):
    await db.notifications.update_many(
        {"user_id": user["_id"], "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {"ok": True}


@router.post("/reminders/run")
async def run_reminders_now(db=Depends(get_db)):
    """Manually trigger the service-reminder check (for testing)."""
    from core.scheduler import check_service_reminders
    sent = await check_service_reminders()
    return {"sent": sent}
