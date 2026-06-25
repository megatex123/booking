# Finance

Financial flows, revenue tracking, and monetisation in Bengkil Lah.

---

## Revenue Model

Bengkil Lah charges a per-booking service fee (future scope). Currently the app **passes the full booking amount** to the workshop and records it for analytics. Revenue data is aggregated server-side and surfaced in the [[Features#Workshop — Dashboard|Revenue & Analytics dashboard]].

---

## Payment Lifecycle

```
Customer creates booking
        ↓
POST /payments/create-intent/{booking_id}
        ↓
  Stripe PaymentIntent created
  → client_secret returned to app
        ↓
  [Native: Stripe SDK captures card]
  [Web: mocked — no real card capture]
        ↓
POST /payments/confirm/{booking_id}
        ↓
  booking.payment_status = "paid"
```

### Payment statuses on a booking

| Value | Meaning |
|---|---|
| `"pending"` | No payment attempted yet |
| `"paid"` | Payment confirmed |
| `"refunded"` | (Future) Refund issued |

The `payment_status` field lives inside the booking document. See [[Data Models#Bookings|Data Models → Bookings]] for the full schema.

### API endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/payments/create-intent/{booking_id}` | Customer | Returns `{ client_secret }` for Stripe SDK |
| POST | `/payments/confirm/{booking_id}` | Customer | Sets `payment_status: "paid"` directly (web fallback) |

---

## PDF Invoice

Completed bookings generate a branded PDF invoice server-side.

- **Endpoint:** `GET /bookings/{id}/invoice`  
- **Library:** `fpdf2` (Helvetica font — Latin-1 characters only)  
- **Trigger:** "Download Invoice" button shown on the booking detail screen when status is `completed`
- **Content:** Workshop name + address, booking date, service line items, per-service products used, total price, completion notes

> The PDF renderer uses `fpdf2` with the built-in Helvetica font. Only Latin-1 characters are safe. Non-Latin characters (e.g. Jawi script) will error.

---

## Revenue Analytics

The analytics dashboard (`AnalyticsDashboardScreen`) fetches aggregated financial data from a single endpoint:

**`GET /workshops/my/analytics?months=N`** (Workshop auth)

Response shape:

```json
{
  "monthly_revenue": [
    { "month": "2026-01", "revenue": 1450.00, "bookings": 12 }
  ],
  "peak_hours": [
    { "hour": 9, "count": 8 },
    { "hour": 10, "count": 11 }
  ],
  "top_services": [
    { "name": "Oil Change", "count": 20, "revenue": 900.00 }
  ],
  "customer_stats": {
    "total": 35,
    "repeat": 18,
    "new": 17
  }
}
```

The frontend toggles between **3M / 6M / 12M** views. Revenue bars, peak-hour bars, top-services ranked list, and a repeat-vs-new customer split bar are all derived from this single response.

---

## Workshop Revenue via CRM

**`GET /workshops/my/customers`** (Workshop auth) groups completed bookings by customer and returns:

```json
[
  {
    "customer_id": "...",
    "name": "Ali",
    "phone": "012-...",
    "total_spent": 650.00,
    "visit_count": 4,
    "last_visit": "2026-05-10T...",
    "vehicles": ["WXY 1234 — Proton Saga", "..."]
  }
]
```

The `CustomerCRMScreen` sorts by **Recent / Top Spender / Most Visits** and displays summary stats (total customers, total revenue, avg spend per customer). See [[Features#Workshop — Customer CRM]].

---

## Key Financial Fields in MongoDB

### `bookings` collection

| Field | Type | Notes |
|---|---|---|
| `total_price` | `float` | Sum of all booked service prices |
| `payment_status` | `str` | `"pending"` \| `"paid"` \| `"refunded"` |
| `services` | `list` | Each entry has `price` at time of booking |

### `workshops` collection

| Field | Path | Notes |
|---|---|---|
| Service price | `services[].price` | Set by vendor; used for booking total |
| Product price | `products[].price` | Unit cost for inventory valuation |
| Product quantity | `products[].quantity` | Current stock level |
| Reorder threshold | `products[].reorder_threshold` | Fires `low_stock` notification when qty ≤ threshold after deduction |

See [[Data Models]] for full collection schemas.

---

## Inventory Cost Tracking

Each product in `workshops.products[]` has:

- `price` — unit cost (used for cost-of-goods estimates)
- `quantity` — current stock
- `reorder_threshold` — alert level (0 = no alert)

When a booking is marked **completed** with `service_reports`, the backend deducts `products_used[].quantity` from stock. If stock falls at or below `reorder_threshold`, a `low_stock` notification is pushed to the workshop owner immediately. See [[Features#Workshop — Inventory (Products)]].

---

## Referral Credits

| Field | Location | Notes |
|---|---|---|
| `referral_code` | `users` | 6-char unique code generated on customer registration |
| `referral_credits` | `users` | RM balance credited when referred bookings complete |
| `referral_discount` | `bookings` | RM amount discounted from this booking via referral |
| `referral_discount_pct` | hardcoded | 10% of booking total, capped at RM50 |
| `reward_per_referral` | hardcoded | RM20 credited to referrer on booking completion |

Referral records tracked in `referrals` collection: `referrer_id`, `referee_id`, `booking_id`, `discount_amount`, `reward_amount`, `status` (`pending` → `rewarded`). See [[API Reference#Referrals]].

## Corporate / Fleet Billing

Corporate accounts (`corporate_accounts` collection) enable monthly consolidated billing:

- Admin registers with company name + SSM registration number
- Fleet vehicles and drivers managed under the account
- Any corporate member books with `payment_type: "corporate"` — booking is tagged `corporate_id`
- `GET /corporate/billing?month=YYYY-MM` aggregates all tagged bookings for the month: total, paid, pending
- Monthly limit (`monthly_limit`) enforced optionally; 0 = unlimited

See [[API Reference#Corporate Accounts]] and [[Features#Fleet / Corporate Accounts]].

## Future Scope

| Item | Status |
|---|---|
| Live Stripe card capture on web | ❌ Mocked — needs `@stripe/stripe-react-native` native build |
| Platform commission / service fee | ❌ Not implemented |
| Corporate monthly PDF statement | ❌ Not implemented |
| Auto-deduct referral credits at checkout | ⚠️ Balance shown, not server-deducted |
| Tax / GST line on invoice | ❌ Not implemented |
| Multi-currency support | ❌ Not implemented |
| Refund flow | ❌ Not implemented |
| Stripe webhook for async payment confirmation | ❌ Not implemented |

---

## Related Notes

- [[API Reference]] — payment, invoice, and analytics endpoints
- [[Data Models]] — booking and workshop collection schemas
- [[Booking Flow]] — when payment is expected in the booking lifecycle
- [[Features]] — feature completion status for payments, invoices, analytics
