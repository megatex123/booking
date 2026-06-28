import socketio
from .security import decode_token

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Maps user_id -> set of socket session ids
connected_users: dict[str, set] = {}


@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token")
    if not token:
        return False
    payload = decode_token(token)
    if not payload:
        return False
    user_id = payload.get("sub")
    await sio.save_session(sid, {"user_id": user_id})
    connected_users.setdefault(user_id, set()).add(sid)


@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if user_id and user_id in connected_users:
        connected_users[user_id].discard(sid)
        if not connected_users[user_id]:
            del connected_users[user_id]


@sio.event
async def join_booking(sid, data):
    booking_id = data.get("booking_id")
    if booking_id:
        await sio.enter_room(sid, f"booking_{booking_id}")


@sio.event
async def leave_booking(sid, data):
    booking_id = data.get("booking_id")
    if booking_id:
        await sio.leave_room(sid, f"booking_{booking_id}")


async def emit_to_user(user_id: str, event: str, data: dict):
    sids = connected_users.get(user_id, set())
    for sid in sids:
        await sio.emit(event, data, to=sid)


async def emit_to_booking_room(booking_id: str, event: str, data: dict, skip_sid: str = None):
    await sio.emit(event, data, room=f"booking_{booking_id}", skip_sid=skip_sid)
