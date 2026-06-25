from datetime import datetime
from bson import ObjectId
from core.socket_manager import emit_to_user


async def push_notification(db, user_id: str, notif_type: str, title: str, body: str, data: dict = {}):
    doc = {
        "_id": str(ObjectId()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "data": data,
        "is_read": False,
        "created_at": datetime.utcnow(),
    }
    await db.notifications.insert_one(doc)
    await emit_to_user(user_id, "new_notification", {
        "id": doc["_id"],
        "type": notif_type,
        "title": title,
        "body": body,
        "data": data,
        "is_read": False,
        "created_at": doc["created_at"].isoformat(),
    })
    return doc
