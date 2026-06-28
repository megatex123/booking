# Realtime (Socket.IO)

## Server Setup

`backend/core/socket_manager.py` creates the Socket.IO server:
```python
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
```

`backend/main.py` wraps FastAPI:
```python
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
```

`connected_users: dict[user_id → socket_id]` — maps authenticated users to their current socket.

## Connection & Auth

On `connect` event, client sends JWT in auth header. Server decodes it, stores `user_id → socket_id` in `connected_users`.

Client-side (`src/services/socket.ts`) calls `connectSocket()` after login or on app reload with a saved token.

## Rooms

Chat rooms are named `booking_{booking_id}`.

| Client Event | Direction | Action |
|---|---|---|
| `join_booking` | Client → Server | Server calls `sio.enter_room(sid, "booking_{id}")` |

## Server-Emitted Events

| Event | Target | Trigger | Payload |
|---|---|---|---|
| `new_booking` | Workshop owner (by user_id) | Customer creates booking | Serialized booking object |
| `booking_status_updated` | Customer (by user_id) + booking room | Workshop changes status / customer cancels / reschedules | Serialized booking object |
| `new_message` | Booking room | Either party sends a chat message | Serialized message object |
| `new_notification` | User (by user_id) | Any push_notification() call | Notification object |

## Emit Helpers (`socket_manager.py`)

```python
emit_to_user(user_id, event, data)
# → looks up socket_id in connected_users, emits to that sid

emit_to_booking_room(booking_id, event, data)
# → emits to room "booking_{booking_id}"
```

If a user is not currently connected (`user_id` not in `connected_users`), `emit_to_user` silently skips — the notification is persisted to the DB and will appear on next app open.

## Client-Side Listeners

### RootNavigator (`src/navigation/index.tsx`)
```ts
sock.on('new_notification', (notif) => dispatch(addNotification(notif)));
dispatch(fetchUnreadCount());
```
Attached whenever `user` changes (login / app reload). Drives the notification badge (ShakingBell).

### BookingDetailScreen / WorkshopBookingDetailScreen
```ts
sock.on('booking_status_updated', (booking) => setBooking(booking));
```
Re-renders the detail screen in real-time when workshop changes status.

### ChatScreen (`src/screens/shared/ChatScreen.tsx`)
```ts
socket.emit('join_booking', { booking_id });
socket.on('new_message', (msg) => setMessages(prev => [...prev, msg]));
```

## datetime Safety

Socket.IO's default JSON encoder does not handle Python `datetime`. All objects emitted through Socket.IO are pre-serialized with `.isoformat()` on every datetime field before being passed to `emit_to_user` or `emit_to_booking_room`.

## Related Notes
- [[Backend]] — `socket_manager.py`, `notifications.py`
- [[Booking Flow]] — which events fire at each status transition
- [[Frontend]] — client-side socket listeners
