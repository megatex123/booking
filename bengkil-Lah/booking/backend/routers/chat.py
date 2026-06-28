from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from core.database import get_db
from core.socket_manager import sio, emit_to_booking_room
from core.notifications import push_notification
from middleware.auth import get_current_user
from models.chat import MessageSend

router = APIRouter(prefix="/chat", tags=["chat"])


def serialize_message(m: dict) -> dict:
    v = m["created_at"]
    return {
        "id": m["_id"],
        "booking_id": m["booking_id"],
        "sender_id": m["sender_id"],
        "sender_name": m["sender_name"],
        "sender_role": m["sender_role"],
        "content": m["content"],
        "created_at": v.isoformat() if hasattr(v, "isoformat") else v,
        "is_read": m.get("is_read", False),
    }


@router.get("/{booking_id}/messages")
async def get_messages(booking_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user["role"] == "customer" and b["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if user["role"] == "workshop":
        workshop = await db.workshops.find_one({"owner_id": user["_id"]})
        if not workshop or b["workshop_id"] != workshop["_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    await db.messages.update_many(
        {"booking_id": booking_id, "sender_id": {"$ne": user["_id"]}},
        {"$set": {"is_read": True}},
    )

    messages = await db.messages.find({"booking_id": booking_id}).sort("created_at", 1).to_list(500)
    return [serialize_message(m) for m in messages]


@router.post("/{booking_id}/messages", status_code=201)
async def send_message(booking_id: str, data: MessageSend, user=Depends(get_current_user), db=Depends(get_db)):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    msg = {
        "_id": str(ObjectId()),
        "booking_id": booking_id,
        "sender_id": user["_id"],
        "sender_name": user["name"],
        "sender_role": user["role"],
        "content": data.content,
        "is_read": False,
        "created_at": datetime.utcnow(),
    }
    await db.messages.insert_one(msg)

    serialized = serialize_message(msg)
    await emit_to_booking_room(booking_id, "new_message", serialized)

    # Notify the other party
    if user["role"] == "customer":
        workshop = await db.workshops.find_one({"_id": b["workshop_id"]})
        if workshop:
            await push_notification(db, workshop["owner_id"], "new_message",
                f"New Message from {user['name']}",
                data.content[:80],
                {"booking_id": booking_id})
    else:
        await push_notification(db, b["customer_id"], "new_message",
            f"New Message from Workshop",
            data.content[:80],
            {"booking_id": booking_id})

    return serialized


@sio.event
async def send_message_ws(sid, data):
    from core.database import get_db as _get_db
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    booking_id = data.get("booking_id")
    content = data.get("content", "").strip()
    if not content or not booking_id:
        return

    db = _get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return

    b = await db.bookings.find_one({"_id": booking_id})

    msg = {
        "_id": str(ObjectId()),
        "booking_id": booking_id,
        "sender_id": user_id,
        "sender_name": user["name"],
        "sender_role": user["role"],
        "content": content,
        "is_read": False,
        "created_at": datetime.utcnow(),
    }
    await db.messages.insert_one(msg)
    await emit_to_booking_room(booking_id, "new_message", serialize_message(msg), skip_sid=sid)
    await sio.emit("new_message", serialize_message(msg), to=sid)

    # Notify the other party
    if b:
        if user["role"] == "customer":
            workshop = await db.workshops.find_one({"_id": b["workshop_id"]})
            if workshop:
                await push_notification(db, workshop["owner_id"], "new_message",
                    f"New Message from {user['name']}",
                    content[:80],
                    {"booking_id": booking_id})
        else:
            await push_notification(db, b["customer_id"], "new_message",
                f"New Message from Workshop",
                content[:80],
                {"booking_id": booking_id})
