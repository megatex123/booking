from datetime import datetime, date, timedelta
from typing import Optional, List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.database import get_db
from middleware.auth import require_workshop

router = APIRouter(prefix="/workshops/my/schedules", tags=["schedules"])

SHIFT_HOURS = {
    "morning":   ("08:00", "13:00"),
    "afternoon": ("13:00", "18:00"),
    "evening":   ("18:00", "22:00"),
    "full_day":  ("08:00", "18:00"),
    "off":       (None, None),
}
VALID_SHIFTS = list(SHIFT_HOURS.keys())
VALID_STATUSES = ["scheduled", "on_duty", "completed", "absent"]


class ShiftCreate(BaseModel):
    mechanic_id: str
    date: str                          # YYYY-MM-DD
    shift: str                         # morning | afternoon | evening | full_day | off
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None


class ShiftUpdate(BaseModel):
    shift: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


def _serialize(doc: dict) -> dict:
    start, end = SHIFT_HOURS.get(doc.get("shift", ""), (None, None))
    stored_start = doc.get("shift_start", start)
    stored_end = doc.get("shift_end", end)
    return {
        "id": doc["_id"],
        "workshop_id": doc["workshop_id"],
        "mechanic_id": doc["mechanic_id"],
        "mechanic_name": doc.get("mechanic_name", ""),
        "mechanic_specialty": doc.get("mechanic_specialty", ""),
        "date": doc["date"],
        "shift": doc["shift"],
        "shift_start": stored_start,
        "shift_end": stored_end,
        "status": doc.get("status", "scheduled"),
        "notes": doc.get("notes"),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


async def _get_workshop(user, db):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(404, "Workshop not found")
    return w


@router.get("/")
async def list_schedules(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to:   Optional[str] = Query(None, description="YYYY-MM-DD"),
    user=Depends(require_workshop),
    db=Depends(get_db),
):
    w = await _get_workshop(user, db)
    q: dict = {"workshop_id": w["_id"]}
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    docs = await db.staff_schedules.find(q).sort("date", 1).to_list(500)
    return [_serialize(d) for d in docs]


@router.get("/today")
async def today_on_duty(
    user=Depends(require_workshop),
    db=Depends(get_db),
):
    w = await _get_workshop(user, db)
    today = date.today().isoformat()
    docs = await db.staff_schedules.find(
        {"workshop_id": w["_id"], "date": today, "shift": {"$ne": "off"}}
    ).sort("shift", 1).to_list(100)
    return [_serialize(d) for d in docs]


@router.post("/", status_code=201)
async def create_shift(
    data: ShiftCreate,
    user=Depends(require_workshop),
    db=Depends(get_db),
):
    if data.shift not in VALID_SHIFTS:
        raise HTTPException(400, f"shift must be one of {VALID_SHIFTS}")
    if data.status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {VALID_STATUSES}")

    w = await _get_workshop(user, db)

    # Resolve mechanic name
    mechanics = w.get("mechanics", [])
    mech = next((m for m in mechanics if m["_id"] == data.mechanic_id), None)
    if not mech:
        raise HTTPException(404, "Mechanic not found in this workshop")

    # Prevent duplicate: same mechanic + date
    existing = await db.staff_schedules.find_one({
        "workshop_id": w["_id"],
        "mechanic_id": data.mechanic_id,
        "date": data.date,
    })
    if existing:
        raise HTTPException(409, "Shift already exists for this mechanic on this date. Use PATCH to update.")

    start, end = SHIFT_HOURS[data.shift]
    now = datetime.utcnow().isoformat()
    doc = {
        "_id": str(ObjectId()),
        "workshop_id": w["_id"],
        "mechanic_id": data.mechanic_id,
        "mechanic_name": mech.get("name", ""),
        "mechanic_specialty": mech.get("specialty", ""),
        "date": data.date,
        "shift": data.shift,
        "shift_start": start,
        "shift_end": end,
        "status": data.status,
        "notes": data.notes,
        "created_at": now,
        "updated_at": now,
    }
    await db.staff_schedules.insert_one(doc)
    return _serialize(doc)


@router.patch("/{shift_id}")
async def update_shift(
    shift_id: str,
    data: ShiftUpdate,
    user=Depends(require_workshop),
    db=Depends(get_db),
):
    w = await _get_workshop(user, db)
    doc = await db.staff_schedules.find_one({"_id": shift_id, "workshop_id": w["_id"]})
    if not doc:
        raise HTTPException(404, "Shift not found")

    updates: dict = {"updated_at": datetime.utcnow().isoformat()}
    if data.shift is not None:
        if data.shift not in VALID_SHIFTS:
            raise HTTPException(400, f"shift must be one of {VALID_SHIFTS}")
        updates["shift"] = data.shift
        start, end = SHIFT_HOURS[data.shift]
        updates["shift_start"] = start
        updates["shift_end"] = end
    if data.status is not None:
        if data.status not in VALID_STATUSES:
            raise HTTPException(400, f"status must be one of {VALID_STATUSES}")
        updates["status"] = data.status
    if data.notes is not None:
        updates["notes"] = data.notes

    await db.staff_schedules.update_one({"_id": shift_id}, {"$set": updates})
    return _serialize({**doc, **updates})


@router.delete("/{shift_id}", status_code=204)
async def delete_shift(
    shift_id: str,
    user=Depends(require_workshop),
    db=Depends(get_db),
):
    w = await _get_workshop(user, db)
    result = await db.staff_schedules.delete_one({"_id": shift_id, "workshop_id": w["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Shift not found")
