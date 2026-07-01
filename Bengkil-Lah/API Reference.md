# API Reference

Base URL: `http://localhost:8000/api/v1`  
Interactive docs: `http://localhost:8000/docs`

Auth: `Authorization: Bearer <JWT>`

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register/customer` | — | Register customer |
| POST | `/auth/register/workshop` | — | Register workshop + owner |
| POST | `/auth/login` | — | Returns `{ access_token, token_type, user }` |
| POST | `/auth/forgot-password` | — | Generates OTP (15 min TTL). In dev: returns `{ demo_otp }` in response body — no email sent |
| POST | `/auth/reset-password` | — | Validates OTP **and** sets new password in one step `{ email, otp, new_password }` |
| PATCH | `/auth/change-password` | Any | Changes password (current required) |

Customers get a single active session — logging in on a new device invalidates the JWT on all other devices (`401 SESSION_EXPIRED`). Workshop accounts are unaffected.

## Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | Any | Current user object |
| PATCH | `/users/me` | Any | Update name, phone, avatar |
| GET | `/users/me/vehicles` | Customer | Stored `users.vehicles` merged with any vehicle plates found in booking history not already stored |
| GET | `/users/online-status` | Workshop | `?user_ids=id1,id2` → online map (workshop-only) |

## Workshops

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/workshops/nearby` | — | `?latitude=&longitude=&radius_km=&category=` |
| GET | `/workshops/{id}` | — | Workshop detail |
| GET | `/workshops/my/profile` | Workshop | Own workshop |
| PATCH | `/workshops/my/profile` | Workshop | Update profile / coordinates |
| POST | `/workshops/my/services` | Workshop | Add service |
| PATCH | `/workshops/my/services/{id}` | Workshop | Edit service |
| DELETE | `/workshops/my/services/{id}` | Workshop | Remove service |
| GET | `/workshops/my/products` | Workshop | Product list |
| POST | `/workshops/my/products` | Workshop | Add product |
| PATCH | `/workshops/my/products/{id}` | Workshop | Edit product |
| DELETE | `/workshops/my/products/{id}` | Workshop | Remove product |
| GET | `/workshops/my/stations` | Workshop | Repair stations |
| POST | `/workshops/my/stations` | Workshop | Add station |
| PATCH | `/workshops/my/stations/{id}` | Workshop | Edit station |
| DELETE | `/workshops/my/stations/{id}` | Workshop | Remove station |
| GET | `/workshops/my/mechanics` | Workshop | Mechanic list |
| POST | `/workshops/my/mechanics` | Workshop | Add mechanic |
| PATCH | `/workshops/my/mechanics/{id}` | Workshop | Edit mechanic |
| DELETE | `/workshops/my/mechanics/{id}` | Workshop | Remove mechanic |
| GET | `/workshops/my/analytics` | Workshop | Revenue & peak hour analytics (`?months=6`) |
| GET | `/workshops/my/customers` | Workshop | CRM — customers grouped by visit history |
| GET | `/workshops/{id}/queue` | — | Force-recompute and return queue snapshot (`total_stations`, `active_jobs`, `available_stations`, `est_wait_minutes`, `avg_job_duration`) |
| PATCH | `/workshops/my/panel` | Workshop | Set `is_panel_workshop` and `panel_providers` list |
| GET | `/workshops/nearby` params | — | Supports `?panel_provider=<slug>` to filter by insurer panel |
| GET | `/workshops/my/promotions` | Workshop | List all promotions (including expired) |
| POST | `/workshops/my/promotions` | Workshop | Create flash deal — `title`, `description`, `ends_at` (ISO 8601) |
| PATCH | `/workshops/my/promotions/{id}` | Workshop | Edit — `title`, `description`, `ends_at`, `is_active` |
| DELETE | `/workshops/my/promotions/{id}` | Workshop | Remove promotion |

## Loyalty Points

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/loyalty/balance` | Customer | Current points, RM value, lifetime earned/used, redemption config |
| GET | `/loyalty/history` | Customer | Bookings where points were earned or used (last 50) |

## Bookings

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/bookings/` | Customer | Create booking |
| GET | `/bookings/my` | Any | `?status=` filter |
| GET | `/bookings/vehicle-health` | Customer | Car health score per vehicle — `[{ plate, vehicle_name, score, last_service_date, next_service_due, days_until_due }]` |
| GET | `/bookings/{id}` | Any | Single booking |
| PATCH | `/bookings/{id}/status` | Workshop | Status transition |
| PATCH | `/bookings/{id}/cancel` | Customer | Cancel booking |
| PATCH | `/bookings/{id}/reschedule` | Customer | Change date/time |
| PATCH | `/bookings/{id}/station` | Workshop | Assign repair station |
| PATCH | `/bookings/{id}/mechanic` | Workshop | Assign mechanic (`{ mechanic_id }`, null to unassign) |
| POST | `/bookings/{id}/quotations` | Workshop | Send an itemized quote — `{ items: [{name, description?, price, quantity}], note? }`. Allowed while booking is `pending`/`confirmed`/`in_progress`. Auto-typed `initial` or `additional` based on current status. |
| PATCH | `/bookings/{id}/quotations/{quotation_id}/respond` | Customer | `{ action: "approve"\|"reject", reason?, promotion_id?, loyalty_points_used? }`. Approving applies an optional promotion + loyalty point discount (same math as booking creation) and adds the **discounted** amount to `total_price`/`quotation_total`; rejecting leaves the total unchanged. A quotation can only be responded to once. |
| GET | `/bookings/{id}/quotations/{quotation_id}/pdf` | Customer or Workshop owner | Branded 1-2 page PDF of an **approved** quotation (`application/pdf`). 400 if the quotation isn't approved yet. |

### Status update body
```json
{
  "status": "confirmed | rejected | in_progress | completed",
  "note": "optional rejection reason",
  "completion_notes": "general summary (required if no service_reports)",
  "next_service_months": 6,
  "service_reports": [
    {
      "service_id": "...",
      "service_name": "Oil Change",
      "work_done": "Replaced oil and filter",
      "products_used": [{ "product_id": "...", "name": "5W-30", "quantity": 4 }],
      "next_service_months": 6
    }
  ]
}
```

## Chat

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/chat/{booking_id}/messages` | Any | Message history |
| POST | `/chat/{booking_id}/messages` | Any | Send message |

## Reviews

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/reviews/` | Customer | Create review |
| GET | `/reviews/my` | Customer | My reviews |
| GET | `/reviews/workshop/{id}` | — | Workshop reviews |
| GET | `/reviews/booking/{id}` | Any | Review for booking |

### Review body
```json
{
  "booking_id": "...",
  "workshop_id": "...",
  "rating": 5,
  "comment": "Great service!"
}
```

## Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments/create-intent/{booking_id}` | Customer | Stripe PaymentIntent → `client_secret` |
| POST | `/payments/confirm/{booking_id}` | Customer | Set `payment_status: "paid"` |

## Referrals

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/referrals/my-code` | Any | Own referral code + stats + credit balance |
| POST | `/referrals/validate` | Customer | Validate a code before booking `{ code }` |
| GET | `/referrals/history` | Any | List of referrals made by this user |

Referral code auto-generated on customer registration. Apply in `POST /bookings/` as `referral_code` — 10% discount capped at RM50. Referrer earns RM20 credit when referee's first booking completes.

## Corporate Accounts

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/corporate/register` | Customer | Create corporate account (caller becomes admin) |
| GET | `/corporate/my` | Any | Own account (admin or driver) |
| PATCH | `/corporate/my` | Customer | Update details (admin only) |
| POST | `/corporate/vehicles` | Customer | Add fleet vehicle |
| PATCH | `/corporate/vehicles/{id}` | Customer | Update vehicle |
| DELETE | `/corporate/vehicles/{id}` | Customer | Remove vehicle |
| POST | `/corporate/drivers/invite` | Customer | Link existing customer by email `{ email }` |
| DELETE | `/corporate/drivers/{user_id}` | Customer | Remove driver |
| GET | `/corporate/billing` | Any | Monthly billing summary `?month=YYYY-MM` |

Bookings under a corporate account: pass `payment_type: "corporate"` in `POST /bookings/`.

## Insurance Claims

| Method | Path | Auth | Description |
|---|---|---|---|
| PATCH | `/workshops/my/panel` | Workshop | Set panel status + providers |
| PATCH | `/bookings/{id}/insurance` | Customer | Submit insurance claim details |
| PATCH | `/bookings/{id}/insurance-status` | Workshop | Update claim status `{ claim_status, claim_note }` |

`panel_providers` values: `takaful`, `etiqa`, `allianz`, `axa`, `msig`, `berjaya_sompo`, `zurich`, `lonpac`.
`claim_status` flow: `submitted → processing → approved / rejected`.
`GET /workshops/nearby` accepts `?panel_provider=<value>` to filter panel workshops.

## Manual Service Logs

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/service-logs/` | Customer | List own logs; `?plate=JWD8726` to filter |
| POST | `/service-logs/` | Customer | Create log — see body below |
| PATCH | `/service-logs/{id}` | Customer | Update any field |
| DELETE | `/service-logs/{id}` | Customer | Remove log |

Body for `POST /service-logs/`:
```json
{
  "vehicle_plate": "JWD8726",
  "service_date": "2026-06-29",
  "location": "Home Garage",
  "services": ["Oil Change", "Air Filter"],
  "notes": "Used Castrol 5W-30",
  "mileage": 45000,
  "cost": 80.00,
  "next_service_months": 3
}
```
Response includes `"source": "manual"`. The `vehicle-health` endpoint merges these logs with completed bookings, using whichever is more recent.

## Vehicle Reminders

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reminders/` | Customer | List own reminders |
| POST | `/reminders/` | Customer | Create `{ vehicle_plate, reminder_date (YYYY-MM-DD), vehicle_name?, label? }` |
| PATCH | `/reminders/{id}` | Customer | Update — date change resets `notified` flag |
| DELETE | `/reminders/{id}` | Customer | Remove |

APScheduler fires `check_custom_reminders()` at 08:00 UTC daily; sends `custom_reminder` notification when date matches today.

## Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications/` | Any | All notifications |
| GET | `/notifications/unread-count` | Any | Badge count |
| PATCH | `/notifications/{id}/read` | Any | Mark one read |
| PATCH | `/notifications/read-all` | Any | Mark all read |

## Uploads

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/uploads/` | Any | Multipart `file` field → `{ url: "/uploads/<hash>.<ext>" }` |

Uploaded files served at `http://localhost:8000/uploads/<filename>`.

## Price Estimator

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/price-estimator/symptoms` | — | List of 17 symptom entries (`id`, `label`, `icon`, `category`) |
| POST | `/price-estimator/estimate` | — | `{ symptom_ids[], latitude, longitude, radius_km? }` → price range + sample services per symptom from nearby workshops |

## Related Notes
- [[Backend]] — router implementation details
- [[Booking Flow]] — status transition rules
- [[Realtime]] — Socket.IO events alongside REST calls
