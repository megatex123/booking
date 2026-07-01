# Data Models

## MongoDB Collections

### `users`
```
_id           string (ObjectId as str)
name          string
email         string (unique)
phone         string
role          "customer" | "workshop"
avatar        string? (path to upload)
address       string? (customer home/mailing address)
password_hash string
otp           string?
otp_expires   datetime?
created_at    datetime
updated_at    datetime
```

### `workshops`
```
_id             string
owner_id        string (ref → users._id)
workshop_name   string
description     string
address         string
phone           string
latitude        float
longitude       float
location        GeoJSON Point { type, coordinates: [lng, lat] }
rating          float (recomputed on review create)
total_reviews   int
is_open         bool
open_hour       string "HH:MM"
close_hour      string "HH:MM"
working_hours   dict[day → { open, close, is_open }]
images          string[] (upload paths)
services        WorkshopService[]
products        Product[]
repair_stations RepairStation[]
created_at      datetime
updated_at      datetime
```

#### WorkshopService (embedded)
```
_id              string
name             string
description      string
price            float
duration_minutes int
category         "oil_change"|"tire"|"brake"|"engine"|"body"|"electrical"|"other"
is_active        bool
default_products DefaultProduct[]  ← product_id + default quantity
created_at       string (ISO)
```

#### Product / Inventory item (embedded)
```
_id          string
name         string
brand        string
category     "lubricant"|"brake"|"filter"|"tyre"|"electrical"|"body"|"other"
price        float
quantity     float  ← decremented on booking completion
unit         "pcs"|"litre"|"kg"|"set"
description  string
service_tags string[]
created_at   string (ISO)
```

#### RepairStation (embedded)
```
_id         string
name        string
description string
is_active   bool
created_at  string (ISO)
```

---

### `bookings`
```
_id              string
customer_id      string (ref → users)
customer_name    string (denormalized)
customer_phone   string (denormalized)
workshop_id      string (ref → workshops)
workshop_name    string (denormalized)
workshop_address string (denormalized)
workshop_owner_id string (ref → users, for socket targeting)
services         WorkshopService[] (snapshot at booking time)
vehicle_plate    string
vehicle_name     string
vehicle_brand    string
scheduled_date   string "YYYY-MM-DD"
scheduled_time   string "HH:MM"
notes            string
status           "pending"|"confirmed"|"rejected"|"in_progress"|"completed"|"cancelled"
total_price      float
quotation_total  float    (sum of approved quotation subtotals, default 0)
quotations       Quotation[]
payment_status   "unpaid"|"paid"
payment_intent_id string?
completion_notes string?
next_service_months int?   (1|3|6|12|24 — minimum across service reports)
service_reports  ServiceReport[]
station_id       string?  (ref → repair_stations._id)
status_note      string?  (rejection reason)
created_at       datetime
updated_at       datetime
```

#### Quotation (embedded, see [[Booking Flow]] for the approval flow)
```
_id                     string (uuid4)
type                    "initial"|"additional"
items                   QuotationItem[]
subtotal                float (sum of item price × quantity)
note                    string?  (workshop's message to customer)
status                  "pending"|"approved"|"rejected"
customer_response_note  string?  (set on reject)
created_at              datetime
responded_at            datetime?
promotion_discount      float?   (set on approve, default 0)
promotion_title         string?  (set on approve, if a promotion was applied)
loyalty_points_used     int?     (set on approve, default 0)
loyalty_discount        float?   (set on approve, default 0)
final_amount            float?   (set on approve — subtotal minus both discounts; this is what's added to total_price)
```

#### QuotationItem (embedded)
```
name        string
description string?
price       float
quantity    float (default 1)
```

#### ServiceReport (embedded, created on completion)
```
service_id    string
service_name  string
work_done     string
products_used ProductUsed[]
next_service_months int?
```

#### ProductUsed (embedded)
```
product_id string
name       string
quantity   float
```

---

### `reviews`
```
_id           string
booking_id    string
workshop_id   string
customer_id   string
customer_name string (denormalized)
rating        int (1–5)
comment       string?
created_at    datetime
```

### `messages`
```
_id          string
booking_id   string
sender_id    string
sender_name  string
sender_role  "customer"|"workshop"
content      string
is_read      bool
created_at   datetime
```

### `notifications`
```
_id        string
user_id    string
type       string  (e.g. "new_booking", "booking_confirmed", "booking_cancelled")
title      string
body       string
data       dict    (e.g. { booking_id })
is_read    bool
created_at datetime
```

---

## TypeScript Types (`src/types/index.ts`)

Key interfaces mirror the MongoDB schemas:

- `User` — id, name, email, phone, role, avatar, address?, created_at
- `Vehicle` — name, plate, brand, year, color *(derived from booking history, not a separate collection)*
- `Workshop` — full workshop info including `services[]`, `working_hours`, `images[]`
- `WorkshopService` — _id, name, description, price, duration_minutes, category, is_active
- `Booking` — full booking with `services[]`, status, payment fields, completion fields
- `Message` — booking_id, sender_id/name/role, content, is_read
- `Review` — rating, comment, customer info, booking/workshop refs
- `BookingStatus` — union type of all 6 status values
- `PaymentStatus` — `'unpaid' | 'paid'`

## Related Notes
- [[Backend]] — Pydantic models and serializers
- [[Booking Flow]] — how booking fields change through status transitions
- [[Features]] — what fields are actively used in the UI
