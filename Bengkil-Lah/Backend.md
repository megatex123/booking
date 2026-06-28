# Backend

FastAPI + Motor (async MongoDB) + Socket.IO, running on Python 3.13.

## File Map

```
backend/
├── main.py                  FastAPI app + Socket.IO ASGI wrapper + APScheduler start/stop
├── seed.py                  Seeds DB with sample users, workshops, bookings
├── requirements.txt
├── start.sh
├── uploads/                 Uploaded workshop images (served as static)
├── core/
│   ├── config.py            Pydantic Settings (reads .env)
│   ├── database.py          Motor async MongoDB connection + get_db()
│   ├── security.py          JWT encode/decode, bcrypt password hashing
│   ├── socket_manager.py    Socket.IO server, connected_users map, emit helpers
│   ├── notifications.py     push_notification() helper — writes to DB + emits
│   └── scheduler.py         APScheduler (daily 09:00 UTC) — check_service_reminders()
├── middleware/
│   └── auth.py              get_current_user, require_customer, require_workshop
├── models/
│   ├── user.py              UserCreate, UserUpdate Pydantic models
│   ├── workshop.py          WorkshopUpdate, WorkshopService, Product, RepairStation
│   ├── booking.py           BookingCreate, BookingStatusUpdate, ServiceReport, etc.
│   ├── chat.py              MessageCreate
│   └── review.py            ReviewCreate
└── routers/
    ├── auth.py
    ├── users.py
    ├── workshops.py
    ├── bookings.py
    ├── chat.py
    ├── reviews.py
    ├── payments.py
    ├── uploads.py
    └── notifications.py
```

## Routers

### auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register/customer` | Create customer account |
| POST | `/auth/register/workshop` | Create workshop + owner account |
| POST | `/auth/login` | Returns JWT access token |
| POST | `/auth/forgot-password` | Send OTP to email |
| POST | `/auth/verify-otp` | Validate OTP code |
| POST | `/auth/reset-password` | Set new password with OTP |
| PATCH | `/auth/change-password` | Change password (authenticated) |

### users
| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Current user profile |
| PATCH | `/users/me` | Update profile / avatar |
| GET | `/users/me/vehicles` | Vehicle list from bookings |
| GET | `/users/online-status` | Socket.IO online check for user IDs |

### workshops
| Method | Path | Description |
|---|---|---|
| GET | `/workshops/nearby` | Geospatial search (`$near`), optional category filter |
| GET | `/workshops/{id}` | Single workshop detail |
| GET | `/workshops/my/profile` | Own workshop (vendor) |
| PATCH | `/workshops/my/profile` | Update profile / coordinates |
| POST | `/workshops/my/services` | Add service |
| PATCH | `/workshops/my/services/{id}` | Edit service |
| DELETE | `/workshops/my/services/{id}` | Remove service |
| GET/POST/PATCH/DELETE | `/workshops/my/products` | Inventory management (supports `reorder_threshold`) |
| GET/POST/PATCH/DELETE | `/workshops/my/stations` | Repair station management |
| GET/POST/PATCH/DELETE | `/workshops/my/mechanics` | Mechanic roster management |
| GET | `/workshops/my/analytics` | Revenue, peak hours, top services, customer stats (`?months=6`) |
| GET | `/workshops/my/customers` | CRM view — grouped by customer, sorted by last visit |

### bookings
See [[Booking Flow]] for the full lifecycle.

| Method | Path | Description |
|---|---|---|
| POST | `/bookings/` | Create booking (customer) |
| GET | `/bookings/my` | My bookings (customer or workshop) |
| GET | `/bookings/vehicle-health` | Car health scores per vehicle (customer) |
| GET | `/bookings/{id}` | Single booking |
| PATCH | `/bookings/{id}/status` | Confirm / reject / start / complete (workshop) |
| PATCH | `/bookings/{id}/cancel` | Cancel (customer) |
| PATCH | `/bookings/{id}/reschedule` | Change date/time (customer) |
| PATCH | `/bookings/{id}/station` | Assign repair station (workshop) |
| PATCH | `/bookings/{id}/mechanic` | Assign mechanic (workshop) |

### chat
| Method | Path | Description |
|---|---|---|
| GET | `/chat/{booking_id}/messages` | Message history |
| POST | `/chat/{booking_id}/messages` | Send message (also emits via Socket.IO) |

### reviews
| Method | Path | Description |
|---|---|---|
| POST | `/reviews/` | Create review (customer, booking must be completed) |
| GET | `/reviews/my` | Customer's own reviews |
| GET | `/reviews/workshop/{id}` | All reviews for a workshop |
| GET | `/reviews/booking/{id}` | Review for a specific booking |

### payments
| Method | Path | Description |
|---|---|---|
| POST | `/payments/create-intent/{booking_id}` | Stripe PaymentIntent |
| POST | `/payments/confirm/{booking_id}` | Mark booking payment as paid |

### uploads
| Method | Path | Description |
|---|---|---|
| POST | `/uploads/` | Multipart file upload → returns `/uploads/<hash>.<ext>` path |

### notifications
| Method | Path | Description |
|---|---|---|
| GET | `/notifications/` | All notifications for current user |
| GET | `/notifications/unread-count` | Badge count |
| PATCH | `/notifications/{id}/read` | Mark one read |
| PATCH | `/notifications/read-all` | Mark all read |
| POST | `/notifications/reminders/run` | Manually trigger service-reminder check (testing) |

### invoices
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/bookings/{id}/invoice` | Customer or Workshop owner | Returns branded PDF invoice (`application/pdf`). 400 if booking not completed. |

## Key Implementation Details

### datetime serialization
Socket.IO's JSON encoder doesn't handle Python `datetime`. All serializer functions (`serialize_booking`, `serialize_message`) call `.isoformat()` on every datetime field. There is also a recursive `_clean()` helper in `bookings.py` for nested structures.

### Geospatial
Workshops store a `location: { type: "Point", coordinates: [lng, lat] }` GeoJSON field. The `nearby` endpoint uses MongoDB `$near` with `$maxDistance` in metres. Haversine distance is also computed in Python for display.

### Inventory deduction + reorder alerts
When a booking is marked `completed` with `service_reports`, each `ProductUsed` record triggers:
```python
db.workshops.update_one(
    {"_id": workshop_id, "products._id": product_id},
    {"$inc": {"products.$.quantity": -quantity}}
)
```
After deduction, any product whose `quantity <= reorder_threshold` (and `reorder_threshold > 0`) triggers a `low_stock` push notification to the workshop owner. `reorder_threshold` is a new optional field on `ProductCreate` / `ProductUpdate` (default `0` = disabled).

### FastAPI route order rule
**Static routes must be defined before wildcard routes.** In `bookings.py` the route order is:
```
POST  /bookings/
GET   /bookings/my
GET   /bookings/vehicle-health   ← must come before /{booking_id}
GET   /bookings/{booking_id}
```
If a static path like `/vehicle-health` is registered *after* `/{booking_id}`, FastAPI matches it as a booking ID lookup and returns 404. This is a standard FastAPI gotcha.

### Car Health Score (`GET /bookings/vehicle-health`)
Groups completed bookings by vehicle plate, picks the most recent per plate, and computes:
```python
score = max(0, min(100, round(100 - elapsed_days / total_days * 100)))
# where total_days = next_service_months * 30
```
Falls back to vehicles listed in `current_user["vehicles"]` for unserviced vehicles (score = 100).

### Password hashing (Python 3.13 workaround)
`passlib[bcrypt]` is broken on Python 3.13. `security.py` calls `bcrypt.hashpw()` / `bcrypt.checkpw()` directly.

### Smart service reminders (scheduler)
`core/scheduler.py` exports an `AsyncIOScheduler` instance. On startup `main.py` adds a daily 09:00 UTC cron job that calls `check_service_reminders()`. That function:
1. Queries all completed bookings with `next_service_months > 0` and `reminder_sent != True`.
2. Computes `due_date = completed_at + next_service_months` (falls back to `updated_at` for old data).
3. If `due_date` is within ±7 days of today, calls `push_notification()` with type `service_reminder`.
4. Sets `reminder_sent: True` on the booking so it fires only once.

Bookings gain a `completed_at` timestamp when marked completed (added in `PATCH /bookings/{id}/status`).

## Related Notes
- [[Data Models]] — Pydantic schemas
- [[Booking Flow]] — status transitions
- [[Realtime]] — Socket.IO events emitted from routers
- [[API Reference]] — consolidated endpoint table
