# Booking Flow

## Status Transition Diagram

```
                    ┌─────────┐
             ┌─────▶│ rejected│
             │      └─────────┘
       ┌─────┴───┐
START ─▶│ pending │
       └─────┬───┘
             │ (workshop confirms)
       ┌─────▼────┐        ┌───────────┐
       │confirmed │───────▶│ cancelled │ (customer only)
       └─────┬────┘        └───────────┘
             │ (workshop starts work)
       ┌─────▼──────┐
       │ in_progress│
       └─────┬──────┘
             │ (workshop marks complete)
       ┌─────▼─────┐
       │ completed  │
       └────────────┘
```

**Who can trigger each transition:**

| Transition | Actor | Notes |
|---|---|---|
| pending → confirmed | Workshop | |
| pending → rejected | Workshop | Can include `status_note` (reason) |
| confirmed → in_progress | Workshop | |
| in_progress → completed | Workshop | Requires completion data (see below) |
| pending → cancelled | Customer | |
| confirmed → cancelled | Customer | |
| pending → rescheduled | Customer | Changes `scheduled_date` + `scheduled_time` |
| confirmed → rescheduled | Customer | |

## Creating a Booking

Customer selects a workshop and one or more services. Backend:
1. Validates workshop exists
2. Looks up each service in workshop's embedded `services[]` array
3. Snapshots the service data into the booking (price, name, etc.)
4. Computes `total_price` as sum of service prices
5. Persists booking with `status: "pending"`, `payment_status: "unpaid"`
6. Emits `new_booking` Socket.IO event to workshop owner
7. Creates a push notification for the workshop

## Completing a Booking

Workshop calls `PATCH /bookings/{id}/status` with `status: "completed"`.

**Required:** at least one of:
- `completion_notes` — a general free-text report
- `service_reports[]` — per-service structured reports

### ServiceReport structure
```json
{
  "service_id": "...",
  "service_name": "Oil Change",
  "work_done": "Changed 4L Castrol 5W-30, replaced oil filter",
  "products_used": [
    { "product_id": "...", "name": "Castrol 5W-30", "quantity": 4 },
    { "product_id": "...", "name": "Oil Filter", "quantity": 1 }
  ],
  "next_service_months": 6
}
```

### Side effects on completion
1. `next_service_months` on the booking is set to the **minimum** across all service reports
2. Each `products_used` entry **decrements** the workshop's inventory:
   ```
   products.$.quantity -= quantity
   ```
3. **Product costs added to `total_price`**: If any `products_used` entry has `unit_price > 0`, the backend calculates:
   ```
   products_total = Σ (unit_price × quantity)
   total_price    = original services_total + products_total
   ```
   Booking fields `services_total` and `products_total` are saved for breakdown display.
4. `booking_status_updated` Socket.IO event → customer
5. Push notification → customer: "Service Completed ✅"
6. Loyalty points awarded = 1 pt per RM1 of **final** `total_price` (includes products)

## Reschedule

Customer can reschedule while booking is `pending` or `confirmed`. Updates `scheduled_date` and `scheduled_time`, emits `booking_status_updated` to workshop, and sends a push notification.

## Cancellation

Customer can cancel while `pending` or `confirmed`. Notifies workshop via Socket.IO + push notification.

## Station Assignment

Workshop can assign a `station_id` (repair bay) to a booking at any time via `PATCH /bookings/{id}/station`. No status change, no notifications — purely operational.

## Payment Flow

1. Customer taps Pay → frontend calls `POST /payments/create-intent/{booking_id}`
2. Backend creates Stripe PaymentIntent, returns `client_secret`
3. Frontend (mock on web) processes card
4. Frontend calls `POST /payments/confirm/{booking_id}`
5. Backend sets `payment_status: "paid"` on booking

*Note: Stripe card capture is mocked on web — the backend flow is wired but the Stripe React Native SDK is stubbed. See [[Features]].*

## Review

A customer can leave exactly one review per `completed` booking. Review creation:
1. Validates booking `status === "completed"` and `customer_id` matches
2. Creates review document
3. Recomputes workshop `rating` and `total_reviews` in place

## Notifications Sent

| Event | Recipient | Title |
|---|---|---|
| Booking created | Workshop | "New Booking Request" |
| Booking confirmed | Customer | "Booking Confirmed ✅" |
| Booking rejected | Customer | "Booking Rejected ❌" |
| Service started | Customer | "Service Started 🔧" |
| Service completed | Customer | "Service Completed ✅" |
| Booking cancelled (by customer) | Workshop | "Booking Cancelled" |
| Booking rescheduled | Workshop | "Booking Rescheduled 📅" |

## Related Notes
- [[Data Models]] — booking schema fields
- [[Backend]] — router implementation
- [[Realtime]] — Socket.IO events emitted during transitions
