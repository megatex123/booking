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
    ├── notifications.py
    ├── reminders.py      vehicle reminders CRUD (vehicle_reminders collection)
    ├── service_logs.py   manual service log CRUD (manual_service_logs collection)
    └── price_estimator.py  symptom catalog + nearby price-range estimates
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

#### Single-device login (customers only)
Customers get a `session_id` (UUID) generated on register/login, stored on `users.session_id` and embedded in the JWT as `sid`. `get_current_user` rejects any customer token whose `sid` doesn't match the DB value with `401 SESSION_EXPIRED`. Logging in on a new device overwrites `session_id`, invalidating all other devices' tokens immediately. Workshop vendors are unaffected — they can stay logged in on multiple devices. Frontend: `setUnauthorizedHandler` in `mobile/src/navigation/index.tsx` shows an alert and logs out when it receives this specific 401 reason.

### users
| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Current user profile (includes `address`) |
| PATCH | `/users/me` | Update profile / avatar / address |
| GET | `/users/me/vehicles` | Merged list: stored `users.vehicles` **+** any vehicle plates found in the customer's bookings that aren't already stored. Prevents vehicles entered only at booking time from going "missing" from My Vehicles. |
| GET | `/users/online-status` | Socket.IO online check for user IDs |

`POST /bookings/` also auto-adds the booking's vehicle to `users.vehicles` if the plate isn't already there, so new bookings stay in sync going forward.

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
| POST | `/bookings/{id}/quotations` | Send itemized quote to customer (workshop) |
| PATCH | `/bookings/{id}/quotations/{qid}/respond` | Approve or reject a pending quotation (customer) |

### Quotations
Workshop sends an itemized quote (`items: [{name, description?, price, quantity}]`, optional `note`) that the customer must explicitly approve before it affects the booking total — nothing is charged automatically. Stored as `booking.quotations: [...]`, each entry has its own `_id`, `status` (`pending`/`approved`/`rejected`), `subtotal`, and timestamps.

Two use cases share the same endpoint, distinguished by `type` (auto-set from the booking's current status at creation time):
- **`initial`** — sent while the booking is `pending` or `confirmed`, e.g. revising the price before work starts.
- **`additional`** — sent while `in_progress`, e.g. extra parts/labor discovered during inspection.

On customer approval, the **discounted** amount (not the raw subtotal) is added to both `booking.total_price` and a running `booking.quotation_total` (separate from `services_total`/`products_total`, which only track the original selected services and completion-time product usage). A quotation can only be responded to once — re-responding to an already-resolved quotation returns `400`. Real-time updates reuse the existing `booking_status_updated` Socket.IO event (no new event needed) so both the customer's and workshop's screens refresh automatically. Push notifications: `quotation_received` (to customer), `quotation_approved` / `quotation_rejected` (to workshop owner).

#### Discounts on quotation approval
`PATCH /bookings/{id}/quotations/{qid}/respond` accepts optional `promotion_id` and `loyalty_points_used` alongside `action`. When approving, the backend reuses the exact same discount math as `POST /bookings/` (see `create_booking`):
1. **Promotion** — looks up the workshop's `promotions[]` for an active, non-expired match; percentage or fixed, capped to the quotation subtotal.
2. **Loyalty points** — rounds `loyalty_points_used` down to the nearest 100, caps to the customer's actual balance and to what the (post-promotion) amount can absorb at `0.01 RM/point`, then deducts the points from `users.loyalty_points`.

The resulting `final_amount = subtotal − promotion_discount − loyalty_discount` is what gets added to `total_price`/`quotation_total` — not the raw subtotal. All of `promotion_discount`, `promotion_title`, `loyalty_points_used`, `loyalty_discount`, `final_amount` are stored on the quotation entry itself for display/PDF. Frontend auto-picks the single best active promotion per quotation (same "best discount wins" logic as `BookingScreen`) rather than offering a picker.

### service-logs (manual service history)
| Method | Path | Description |
|---|---|---|
| GET | `/service-logs/` | Customer's manual logs (`?plate=` to filter by vehicle) |
| POST | `/service-logs/` | Create log (`vehicle_plate`, `service_date`, `location`, `services[]`, `notes?`, `mileage?`, `cost?`, `next_service_months?`) |
| PATCH | `/service-logs/{id}` | Update log |
| DELETE | `/service-logs/{id}` | Remove log |

### reminders (vehicle reminders)
| Method | Path | Description |
|---|---|---|
| GET | `/reminders/` | Customer's vehicle reminders |
| POST | `/reminders/` | Create reminder (`vehicle_plate`, `reminder_date`, `vehicle_name?`, `label?`) |
| PATCH | `/reminders/{id}` | Update reminder — resets `notified: false` if date changes |
| DELETE | `/reminders/{id}` | Remove reminder |

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
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/uploads/` | Any authenticated user | Multipart file upload → returns `/uploads/<hash>.<ext>` path. Accepts image/jpeg, image/png, image/webp, image/gif, video/mp4, video/quicktime, video/webm, video/x-msvideo (max 100 MB). Auth: `get_current_user` (was incorrectly `require_workshop` — fixed so customers can upload avatars). |

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
| GET | `/bookings/{id}/quotations/{qid}/pdf` | Customer or Workshop owner | Returns branded PDF of an **approved** quotation. 400 if not yet approved. Built by `build_quotation_pdf()` in `routers/invoices.py` — same fpdf2 layout system as the invoice (header band, item table, stamp/signature box, footer), reused for quotations since both live in the same router. |

### price-estimator
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/price-estimator/symptoms` | — | Returns the 17-entry symptom catalog (`id`, `label`, `icon`, `category`) |
| POST | `/price-estimator/estimate` | — | Body: `{ symptom_ids[], latitude, longitude, radius_km? }`. Finds nearby workshops via `$near`, matches active services by `category` or keyword scan against service name/description, returns per-symptom `min_price`/`max_price`/`avg_price`/`workshop_count` plus up to 5 sample services sorted by price. |

Symptoms map to one of the existing service categories (`brake`, `electrical`, `engine`, `oil_change`, `tire`, `body`, `other`) with extra keyword lists (e.g. "squeaky brakes" → category `brake` + keywords `brake/pad/disc/caliper/drum`) to catch services that don't have a matching category but mention the right words in their name/description.

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
