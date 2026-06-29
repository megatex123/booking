from datetime import datetime, date, timedelta
from typing import Optional, List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.database import get_db
from core.notifications import push_notification
from core.socket_manager import emit_to_user, emit_to_queue_room
from middleware.auth import get_current_user, require_customer, require_workshop

router = APIRouter(prefix="/queue", tags=["queue"])

ACTIVE_STATUSES = {"waiting", "called", "serving"}


class JoinQueue(BaseModel):
    vehicle_plate: str
    vehicle_name: Optional[str] = None
    service_note: Optional[str] = None


class UpdateEntry(BaseModel):
    status: str   # waiting | called | serving | done | left


def _serialize(doc: dict, position: int | None = None) -> dict:
    def _iso(v):
        return v.isoformat() if isinstance(v, datetime) else v

    return {
        "id": doc["_id"],
        "workshop_id": doc["workshop_id"],
        "workshop_name": doc.get("workshop_name", ""),
        "customer_id": doc["customer_id"],
        "customer_name": doc.get("customer_name", ""),
        "vehicle_plate": doc["vehicle_plate"],
        "vehicle_name": doc.get("vehicle_name"),
        "service_note": doc.get("service_note"),
        "queue_number": doc["queue_number"],
        "position": position,
        "status": doc["status"],
        "joined_at": _iso(doc.get("joined_at")),
        "called_at": _iso(doc.get("called_at")),
        "served_at": _iso(doc.get("served_at")),
        "done_at": _iso(doc.get("done_at")),
    }


async def _compute_queue(db, workshop_id: str):
    """Return all active entries sorted by joined_at."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    docs = await db.queue_waitlist.find({
        "workshop_id": workshop_id,
        "status": {"$in": list(ACTIVE_STATUSES)},
        "joined_at": {"$gte": today_start},
    }).sort("joined_at", 1).to_list(200)
    return docs


async def _broadcast_queue(db, workshop_id: str):
    """Push queue_updated to the workshop's queue Socket.IO room."""
    docs = await _compute_queue(db, workshop_id)
    entries = []
    pos = 1
    for d in docs:
        p = pos if d["status"] == "waiting" else None
        entries.append(_serialize(d, position=p))
        if d["status"] == "waiting":
            pos += 1
    await emit_to_queue_room(workshop_id, "queue_updated", {
        "workshop_id": workshop_id,
        "entries": entries,
        "total_waiting": sum(1 for e in entries if e["status"] == "waiting"),
    })


# ── Public: view queue ────────────────────────────────────────────────

@router.get("/{workshop_id}/entries")
async def get_queue(workshop_id: str, db=Depends(get_db)):
    docs = await _compute_queue(db, workshop_id)
    result = []
    pos = 1
    for d in docs:
        p = pos if d["status"] == "waiting" else None
        result.append(_serialize(d, position=p))
        if d["status"] == "waiting":
            pos += 1
    return result


# ── Customer: join ────────────────────────────────────────────────────

@router.post("/{workshop_id}/join", status_code=201)
async def join_queue(
    workshop_id: str,
    data: JoinQueue,
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    workshop = await db.workshops.find_one({"_id": workshop_id})
    if not workshop:
        raise HTTPException(404, "Workshop not found")

    # One active entry per customer per workshop
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    existing = await db.queue_waitlist.find_one({
        "workshop_id": workshop_id,
        "customer_id": current_user["_id"],
        "status": {"$in": list(ACTIVE_STATUSES)},
        "joined_at": {"$gte": today_start},
    })
    if existing:
        raise HTTPException(409, "You are already in this workshop's queue.")

    # Queue number = count of today's entries + 1
    count = await db.queue_waitlist.count_documents({
        "workshop_id": workshop_id,
        "joined_at": {"$gte": today_start},
    })
    queue_number = count + 1

    now = datetime.utcnow()
    doc = {
        "_id": str(ObjectId()),
        "workshop_id": workshop_id,
        "workshop_name": workshop.get("name", ""),
        "customer_id": current_user["_id"],
        "customer_name": current_user.get("name", ""),
        "vehicle_plate": data.vehicle_plate.upper().strip(),
        "vehicle_name": data.vehicle_name,
        "service_note": data.service_note,
        "queue_number": queue_number,
        "status": "waiting",
        "joined_at": now,
        "called_at": None,
        "served_at": None,
        "done_at": None,
    }
    await db.queue_waitlist.insert_one(doc)

    # Position = count of waiting entries before this one
    waiting_before = await db.queue_waitlist.count_documents({
        "workshop_id": workshop_id,
        "status": "waiting",
        "joined_at": {"$lt": now},
    })
    position = waiting_before + 1

    await _broadcast_queue(db, workshop_id)

    # Notify workshop owner
    owner = await db.users.find_one({"_id": workshop.get("owner_id")})
    if owner:
        await push_notification(
            db=db,
            user_id=owner["_id"],
            notification_type="queue_join",
            title="New Walk-in",
            body=f"{current_user.get('name', 'A customer')} joined your queue (#{queue_number})",
            data={"workshop_id": workshop_id, "entry_id": doc["_id"]},
        )

    return _serialize(doc, position=position)


# ── Customer: my active entries ───────────────────────────────────────

@router.get("/my/entries")
async def my_queue_entries(
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    docs = await db.queue_waitlist.find({
        "customer_id": current_user["_id"],
        "joined_at": {"$gte": today_start},
    }).sort("joined_at", -1).to_list(20)

    result = []
    for d in docs:
        # Compute position
        pos = None
        if d["status"] == "waiting":
            pos = await db.queue_waitlist.count_documents({
                "workshop_id": d["workshop_id"],
                "status": "waiting",
                "joined_at": {"$lte": d["joined_at"]},
            })
        result.append(_serialize(d, position=pos))
    return result


# ── Customer: leave queue ─────────────────────────────────────────────

@router.patch("/my/{entry_id}/leave")
async def leave_queue(
    entry_id: str,
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    doc = await db.queue_waitlist.find_one({"_id": entry_id, "customer_id": current_user["_id"]})
    if not doc:
        raise HTTPException(404, "Entry not found")
    if doc["status"] not in ACTIVE_STATUSES:
        raise HTTPException(400, "Cannot leave a completed or already-left entry")

    await db.queue_waitlist.update_one(
        {"_id": entry_id},
        {"$set": {"status": "left", "done_at": datetime.utcnow()}}
    )
    await _broadcast_queue(db, doc["workshop_id"])
    return {"message": "Left queue"}


# ── Workshop: manage queue ────────────────────────────────────────────

@router.get("/manage/entries")
async def workshop_queue(
    current_user: dict = Depends(require_workshop),
    db=Depends(get_db),
):
    workshop = await db.workshops.find_one({"owner_id": current_user["_id"]})
    if not workshop:
        raise HTTPException(404, "Workshop not found")
    docs = await _compute_queue(db, workshop["_id"])
    result = []
    pos = 1
    for d in docs:
        p = pos if d["status"] == "waiting" else None
        result.append(_serialize(d, position=p))
        if d["status"] == "waiting":
            pos += 1
    return result


@router.patch("/manage/{entry_id}/status")
async def update_entry_status(
    entry_id: str,
    body: UpdateEntry,
    current_user: dict = Depends(require_workshop),
    db=Depends(get_db),
):
    workshop = await db.workshops.find_one({"owner_id": current_user["_id"]})
    if not workshop:
        raise HTTPException(404, "Workshop not found")

    valid = {"waiting", "called", "serving", "done", "left"}
    if body.status not in valid:
        raise HTTPException(400, f"status must be one of {valid}")

    doc = await db.queue_waitlist.find_one({"_id": entry_id, "workshop_id": workshop["_id"]})
    if not doc:
        raise HTTPException(404, "Entry not found")

    updates: dict = {"status": body.status}
    if body.status == "called":
        updates["called_at"] = datetime.utcnow()
    elif body.status == "serving":
        updates["served_at"] = datetime.utcnow()
    elif body.status in ("done", "left"):
        updates["done_at"] = datetime.utcnow()

    await db.queue_waitlist.update_one({"_id": entry_id}, {"$set": updates})
    await _broadcast_queue(db, workshop["_id"])

    # Notify customer when called
    if body.status == "called":
        # Compute how many truly waiting entries remain ahead of this customer
        # (this customer is now "called", not waiting)
        await push_notification(
            db=db,
            user_id=doc["customer_id"],
            notification_type="queue_called",
            title="It's your turn! 🔔",
            body=f"{workshop.get('name', 'The workshop')} is ready for you. Head in now!",
            data={"entry_id": entry_id, "workshop_id": workshop["_id"]},
        )
        await emit_to_user(doc["customer_id"], "queue_called", {
            "entry_id": entry_id,
            "workshop_name": workshop.get("name", ""),
            "message": "It's your turn! The workshop is ready for you.",
        })

    return _serialize({**doc, **updates})


@router.delete("/manage/{entry_id}", status_code=204)
async def remove_entry(
    entry_id: str,
    current_user: dict = Depends(require_workshop),
    db=Depends(get_db),
):
    workshop = await db.workshops.find_one({"owner_id": current_user["_id"]})
    if not workshop:
        raise HTTPException(404, "Workshop not found")
    result = await db.queue_waitlist.delete_one({"_id": entry_id, "workshop_id": workshop["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Entry not found")
    await _broadcast_queue(db, workshop["_id"])
