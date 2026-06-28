from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.database import get_db
from middleware.auth import require_customer

router = APIRouter(prefix="/reminders", tags=["reminders"])


class ReminderCreate(BaseModel):
    vehicle_plate: str
    vehicle_name: Optional[str] = None
    reminder_date: str  # "YYYY-MM-DD"
    label: Optional[str] = None


class ReminderUpdate(BaseModel):
    reminder_date: Optional[str] = None
    label: Optional[str] = None


def _serialize(doc: dict) -> dict:
    def _iso(v):
        return v.isoformat() if isinstance(v, datetime) else v

    return {
        "id": doc["_id"],
        "vehicle_plate": doc["vehicle_plate"],
        "vehicle_name": doc.get("vehicle_name"),
        "reminder_date": doc["reminder_date"],
        "label": doc.get("label", "Service Reminder"),
        "notified": doc.get("notified", False),
        "created_at": _iso(doc.get("created_at")),
        "updated_at": _iso(doc.get("updated_at")),
    }


@router.get("/")
async def list_reminders(current_user: dict = Depends(require_customer), db=Depends(get_db)):
    docs = await db.vehicle_reminders.find({"user_id": current_user["_id"]}).to_list(200)
    return [_serialize(d) for d in docs]


@router.post("/")
async def create_reminder(
    data: ReminderCreate,
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    now = datetime.utcnow()
    doc = {
        "_id": str(ObjectId()),
        "user_id": current_user["_id"],
        "vehicle_plate": data.vehicle_plate.upper().strip(),
        "vehicle_name": data.vehicle_name,
        "reminder_date": data.reminder_date,
        "label": data.label or "Service Reminder",
        "notified": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.vehicle_reminders.insert_one(doc)
    return _serialize(doc)


@router.patch("/{reminder_id}")
async def update_reminder(
    reminder_id: str,
    data: ReminderUpdate,
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    doc = await db.vehicle_reminders.find_one(
        {"_id": reminder_id, "user_id": current_user["_id"]}
    )
    if not doc:
        raise HTTPException(404, "Reminder not found")

    updates: dict = {"updated_at": datetime.utcnow()}
    if data.reminder_date is not None:
        updates["reminder_date"] = data.reminder_date
        updates["notified"] = False  # reset so notification fires again on new date
    if data.label is not None:
        updates["label"] = data.label

    await db.vehicle_reminders.update_one({"_id": reminder_id}, {"$set": updates})
    return _serialize({**doc, **updates})


@router.delete("/{reminder_id}")
async def delete_reminder(
    reminder_id: str,
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    result = await db.vehicle_reminders.delete_one(
        {"_id": reminder_id, "user_id": current_user["_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Reminder not found")
    return {"message": "deleted"}
