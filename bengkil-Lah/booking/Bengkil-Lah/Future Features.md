# Future Features

Features planned but not yet implemented. These are design-stage ideas — no backend or frontend code exists for them yet.

---

## Car Pickup & Delivery (Concierge Service)

**Status:** ❌ Not implemented

A driver picks up the customer's car from their home or office, takes it to the workshop for servicing, and returns it when done. The customer never has to leave their desk.

### Why
Dropping a car at a workshop means losing half a day — commute there, wait for a Grab back, repeat in the evening. For working adults in KL and PJ this friction is often the reason they delay servicing. Making pickup optional at checkout removes that blocker entirely and commands a premium price point. Workshops that offer this already do it via WhatsApp arrangements — this formalises and scales it.

### How it fits into the existing booking flow

```
Booking created (with pickup_delivery: true)
    ↓
Workshop assigns a driver (from their staff/mechanic list)
    ↓
Driver dispatched → customer notified: "Driver is on the way"
    ↓
Driver arrives → takes condition photos → customer hands over keys
    ↓  [pickup_status: picked_up]
Car at workshop → serviced as normal
    ↓  [booking status: in_progress → completed]
Driver dispatched for return
    ↓
Car returned → customer signs off via app → takes condition photos
    ↓  [pickup_status: delivered]
```

### Data model additions (booking document)

```json
{
  "pickup_delivery": true,
  "pickup_address":  { "lat": 3.148, "lng": 101.686, "label": "Menara KLCC, Level 22" },
  "dropoff_address": { "lat": 3.148, "lng": 101.686, "label": "same as pickup" },
  "pickup_time":     "2026-07-10T09:00:00",
  "pickup_fee":      25.00,
  "pickup_driver_id": "<mechanic_id>",
  "pickup_status":   "pending | en_route_pickup | picked_up | at_workshop | en_route_return | delivered",
  "pickup_condition_photos":  ["url1", "url2"],
  "dropoff_condition_photos": ["url3", "url4"]
}
```

### Backend design

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/bookings/` | Customer | existing endpoint — add `pickup_delivery`, `pickup_address`, `pickup_time`, `dropoff_address` fields |
| PATCH | `/bookings/{id}/pickup-driver` | Workshop | assign a driver from their mechanic list |
| PATCH | `/bookings/{id}/pickup-status` | Driver | advance `pickup_status` through the state machine |
| POST | `/bookings/{id}/condition-report` | Driver | upload condition photos (intake or return) |
| GET | `/bookings/{id}/pickup-status` | Customer | poll or Socket.IO push for live status |

Socket.IO event: `pickup_status_updated` → customer room, same pattern as `booking_status_updated`.

### Frontend design

**Customer — BookingScreen:**
- "Add Pickup & Delivery" toggle below the service list
- When toggled on: address input (pre-fill from device location), time picker for collection slot, optional separate dropoff address
- Pricing preview: "Pickup & delivery fee: RM {workshop.pickup_fee}" shown in booking summary

**Customer — BookingDetailScreen:**
- New "Pickup Status" card appears when `pickup_delivery: true`
- Step-by-step status bar: Assigned → Driver en route → Picked up → At workshop → Returning → Delivered
- Condition photos viewable (tap to expand) — protects customer from damage disputes

**Workshop — WorkshopBookingDetailScreen:**
- "Assign Driver" button when booking has `pickup_delivery: true`
- Driver picker (reuses the mechanic grid from mechanic assignment)
- Driver taps status buttons from their phone: "I'm on the way", "Car picked up", "Car returned"

### Pricing model
- Workshop sets their own `pickup_fee_base` (e.g. RM 20) and `pickup_fee_per_km` (e.g. RM 1.50) on their profile
- Fee is calculated server-side using Haversine distance between workshop and pickup address
- Bengkil Lah takes 10% of the pickup fee on top of the normal booking commission

### Condition report — damage protection
Both driver and customer take photos at handover (pickup) and handback (return). Photos are timestamped and stored immutably. If a damage dispute arises, both parties have photographic evidence. This is the key trust-building feature that separates the platform from ad-hoc WhatsApp arrangements.

### Related notes
- [[Booking Flow]] — pickup_status is a parallel state machine alongside booking status
- [[Data Models]] — booking schema (new fields above), workshop schema (`pickup_fee_base`, `pickup_fee_per_km`)
- [[Realtime]] — new `pickup_status_updated` Socket.IO event
- [[API Reference]] — new endpoints to add when implemented
- [[Features]] — Mechanic Management (driver pool reuses this)

---

## WhatsApp Status Updates

**Status:** ❌ Not implemented

Send a WhatsApp message to the customer whenever their booking status changes (confirmed, in-progress, completed, rejected).

### Why
Most Malaysians check WhatsApp far more frequently than any standalone app. Push notifications get ignored; WhatsApp messages get read. This closes the loop without requiring the customer to be in-app.

### Trigger points
| Booking event | Message to send |
|---|---|
| `confirmed` | "Your booking at {workshop} on {date} is confirmed." |
| `in_progress` | "Your car is now being serviced at {workshop}." |
| `completed` | "Service done! Total: RM{amount}. Download invoice: {link}" |
| `rejected` | "Your booking was not accepted. Reason: {status_note}" |

### Implementation outline
- **Provider:** WhatsApp Business API (via Meta, or a local aggregator like Twilio, Vonage, or Wati.io which has simpler onboarding for MY businesses)
- **Backend hook:** Extend `PATCH /bookings/{id}/status` in `backend/routers/bookings.py` — after status is saved, call an async `send_whatsapp()` helper
- **Customer record:** Store `phone_number` on the customer model (currently missing — see [[Data Models]])
- **Template approval:** WhatsApp Business API requires pre-approved message templates for outbound (non-session) messages; each status message above needs a registered template
- **Config:** Add `WHATSAPP_API_TOKEN` and `WHATSAPP_PHONE_ID` to `.env`

### Related notes
- [[Realtime]] — current notification path (Socket.IO + in-app)
- [[Backend]] — `bookings.py` status transition handler
- [[Data Models]] — customer schema (phone field needed)

---

## AI Service Advisor

**Status:** ❌ Not implemented

Customer describes a symptom in plain language ("my car vibrates when braking", "engine makes noise on cold start") and the app suggests which services to book. Reduces friction for non-technical users.

### Why
Most workshop customers don't know the name of what they need serviced — they know the symptom. A suggestion layer removes the guesswork and increases booking conversion.

### Two implementation tiers

#### Tier 1 — Keyword mapper (no API cost)
A local `symptom_map` dict: keywords → service category names. Fast, free, works offline.

```python
SYMPTOM_MAP = {
    "vibrate": ["Brake Inspection", "Wheel Balancing", "Tyre Rotation"],
    "brake":   ["Brake Inspection", "Brake Pad Replacement"],
    "noise":   ["Engine Check", "Belt Inspection"],
    "smoke":   ["Engine Check", "Oil Change"],
    "overheat":["Coolant Flush", "Radiator Check"],
    "battery": ["Battery Replacement", "Electrical Inspection"],
}
```

Match is a case-insensitive keyword scan over the customer's free-text input. Return matched service names; filter against the selected workshop's actual service list.

#### Tier 2 — Claude API call (richer, contextual)
Send the symptom description to the Claude API with a system prompt that knows the workshop's service catalogue. Returns a ranked list with a short explanation per suggestion.

```
System: You are a car service advisor. The workshop offers these services: {service_list}.
        Given the customer's symptom, suggest 1–3 services (name + one-line reason).
        Respond as JSON: [{"service": "...", "reason": "..."}]
User:   My car vibrates badly when I press the brakes.
```

Use model `claude-haiku-4-5-20251001` for cost (fast, cheap, sufficient for this task).

### Backend design
- New endpoint: `POST /workshops/{id}/advisor` — body `{symptom: str}`, returns `{suggestions: [{service_name, reason}]}`
- Auth: customer JWT
- No DB writes — purely inference

### Frontend design
- Add a "Describe your problem" text input above the services list in `BookingScreen`
- On submit (or 300ms debounce), call the advisor endpoint and show matched services as pre-selected chips
- Customer can accept, dismiss, or override the suggestion

### Related notes
- [[Frontend]] — `BookingScreen` in `src/screens/customer/`
- [[Backend]] — workshops router
- [[API Reference]] — new endpoint to add when implemented
- [[claude-api]] — model selection and prompt patterns

---

## Quote Request (Multi-Workshop Bidding)

**Status:** ❌ Not implemented

Customer describes a repair job and sends a quote request to multiple workshops at once. Each workshop responds with a price and estimated duration. Customer picks the best offer and converts it to a booking.

### Why
For non-routine work (accident damage, engine problems, major repairs) customers don't know what it should cost and are afraid of being overcharged. A bidding layer restores trust and creates a discovery wedge for new workshops to win customers on merit.

### Flow
```
Customer: "My bumper is cracked, need respray" + photos
    ↓ broadcast to N nearby workshops
Workshop: submits quote (price, ETA, note) within 24h
    ↓ customer sees ranked list of quotes
Customer: taps Accept → converts to confirmed booking
```

### Data model additions
- New collection: `quote_requests` — `{customer_id, description, photos[], vehicle, expires_at, status}`
- New collection: `quotes` — `{request_id, workshop_id, price, eta_hours, note, submitted_at}`
- Booking creation accepts `quote_id` to link the accepted quote

### Backend design
- `POST /quotes/request` — customer creates request, backend fans out `new_quote_request` Socket.IO event to nearby workshops
- `POST /quotes/{request_id}/respond` — workshop submits quote
- `GET /quotes/my-requests` — customer views their open requests + received quotes
- `PATCH /quotes/{quote_id}/accept` — creates a confirmed booking, expires other quotes

### Related notes
- [[Booking Flow]] — quote acceptance inserts before `pending` status
- [[Realtime]] — new Socket.IO events needed
- [[API Reference]] — new endpoints to add when implemented

---

## Vehicle Registration OCR

**Status:** ❌ Not implemented

Customer snaps a photo of their road tax sticker or MyVehicle printout; the app reads the plate number, make, model, and year automatically and pre-fills the booking form.

### Why
Manual vehicle entry is error-prone and annoying. Malaysian road tax stickers have a consistent format. OCR removes the biggest source of drop-off at the booking screen, especially for users with multiple vehicles.

### Implementation outline
- **Provider:** Google Cloud Vision API or Azure Computer Vision — both read Malaysian road tax format reliably. Alternatively, a lightweight on-device ML model via `expo-camera` + ONNX Runtime.
- **Frontend:** Add a "Scan road tax" camera button in `BookingScreen` vehicle section. Capture image → upload to backend → receive parsed fields.
- **Backend endpoint:** `POST /ocr/road-tax` — accepts image, calls Vision API, returns `{plate, make, model, year}`. No DB write; caller decides whether to save as a vehicle.
- **Fallback:** If confidence < 80%, show raw extracted text and let user correct it before saving.

### Related notes
- [[Frontend]] — `BookingScreen` vehicle input
- [[Data Models]] — `vehicles` embedded in customer doc

---

## Digital Job Card (QR Intake)

**Status:** ❌ Not implemented

When a customer arrives, the workshop scans a QR code from the app to mark the car as received. On departure, another scan marks handover complete. Replaces paper job cards and gives customers a timestamped paper trail.

### Why
Every Malaysian workshop today uses a handwritten paper job card. It gets lost, it's unreadable, and there's no record of when the car was actually received or returned. A QR-based digital job card is a zero-cost upgrade that creates a defensible audit trail — and is a strong vendor selling point.

### Flow
```
Customer opens BookingDetail → shows QR code
Workshop scans QR on arrival   → status: in_progress + timestamp
Workshop scans QR on departure → status: awaiting_pickup + timestamp
Customer scans to confirm pickup → status: completed
```

### Implementation outline
- QR payload: signed JWT containing `{booking_id, action: "intake"|"handover"|"pickup"}`
- **Frontend (customer):** `BookingDetailScreen` shows a fullscreen QR when booking is confirmed. Third scan triggers a "Confirm you have received your car" prompt.
- **Frontend (workshop):** `WorkshopBookingDetailScreen` gets a "Scan Customer QR" button that opens the camera.
- **Backend:** `POST /bookings/{id}/qr-scan` — validates JWT, checks action matches expected next state, applies the status transition.
- No new collection needed — timestamps stored as `intake_at`, `handover_at`, `pickup_at` on the booking doc.

### Related notes
- [[Booking Flow]] — new sub-states within `in_progress`
- [[Data Models]] — booking schema (new timestamp fields)

---

## Parts Marketplace (B2B)

**Status:** ❌ Not implemented

Workshops can list excess spare parts inventory for sale to other workshops on the platform. Bengkil Lah takes a small transaction fee.

### Why
Independent workshops routinely over-buy parts (minimum order quantities, bulk discounts) and end up with slow-moving stock. Other workshops need those same parts urgently. A B2B marketplace within the platform monetises the inventory system that's already built and creates a new network effect — the more workshops on the platform, the more liquid the parts market.

### Data model
- New collection: `parts_listings` — `{workshop_id, product_id, qty_available, price_per_unit, condition: "new"|"unused_open", listed_at, expires_at}`
- New collection: `parts_orders` — `{buyer_workshop_id, listing_id, qty, total, status, created_at}`

### Backend design
- `GET /marketplace/parts` — search by category, brand, location radius
- `POST /marketplace/parts` — workshop creates a listing (links to existing product in their inventory)
- `POST /marketplace/parts/{id}/order` — buyer places order; escrow hold on buyer's wallet
- `PATCH /marketplace/parts/orders/{id}/confirm-delivery` — releases payment to seller

### Revenue
Platform charges 3–5% on each parts transaction. Low friction — payments go through existing Stripe infrastructure.

### Related notes
- [[Features]] — Workshop Inventory section (source of stock data)
- [[Data Models]] — `products` collection

---

## Supplier Purchase Orders

**Status:** ❌ Not implemented

When a product in a workshop's inventory hits its reorder threshold, the system auto-generates a purchase order (PO) and — optionally — sends it directly to the workshop's preferred parts supplier via email or API.

### Why
The reorder alert already fires (see [[Features]] — Inventory). But the workshop still has to manually call or WhatsApp their supplier. Closing that last step turns a passive alert into an active supply chain tool, which is a meaningful SaaS upsell for busy workshops.

### Implementation outline
- **New model field:** `product.preferred_supplier` — `{name, email, phone, account_no}`
- **Trigger:** same point as the existing reorder notification (post-deduction in `bookings.py`). If `preferred_supplier.email` is set and `qty <= reorder_threshold`, generate a PO.
- **PO format:** PDF via `fpdf2` (already a dependency). Includes workshop name, product name, SKU, suggested reorder quantity (`reorder_threshold * 2`), date. Attached to an email via `smtplib`.
- **Backend endpoint:** `POST /workshops/my/inventory/{product_id}/send-po` — manual trigger if the vendor wants to fire it on demand.
- **Frontend:** "Send PO to Supplier" button on the product detail card in inventory screen. Supplier email/account editable inline.

### Related notes
- [[Backend]] — reorder alert logic in `bookings.py`
- [[Data Models]] — `products` collection

---

## JPJ / Puspakom Inspection Reminder

**Status:** ❌ Not implemented

Remind customers when their vehicle inspection (Puspakom) or road tax is due, and surface nearby Puspakom-approved centres and panel workshops that handle the paperwork.

### Why
Puspakom inspection and road tax renewal are mandatory in Malaysia — cars over 3 years old need annual Puspakom clearance for road tax. Most Malaysians miss the deadline, pay fines, or scramble last minute. A timely reminder with a "book now" CTA turns a compliance headache into a booking. No competitor in the MY automotive space does this end-to-end.

### Data model
- Add `road_tax_expiry` and `puspakom_due` date fields to the vehicle record (customer fills in once, app reminds annually)
- APScheduler job: daily scan for vehicles with expiry ≤ 30 days → send in-app notification + (future) WhatsApp

### Backend design
- Extend vehicle schema with `road_tax_expiry: date`, `puspakom_due: date`
- `GET /workshops/?services=puspakom` — filter workshops that offer Puspakom assistance
- Scheduled job in `core/scheduler.py` alongside the existing service reminder job

### Frontend design
- `VehicleDetailScreen` — add expiry date fields with a date picker
- Notification deep-links to `WorkshopListScreen` filtered to Puspakom services

### Related notes
- [[Data Models]] — vehicle schema
- [[Backend]] — `core/scheduler.py` (existing reminder scheduler)
- [[Features]] — Smart service reminders (existing pattern to follow)

---

## EV Service Support

**Status:** ❌ Not implemented

Dedicated service categories and a mechanic certification flag for electric vehicles (EVs). Customers with EVs can filter to EV-certified workshops. Malaysia's EV market (BYD, Tesla, Proton Emas) is growing rapidly.

### Why
EV servicing is fundamentally different — high-voltage systems, battery management, regenerative brakes. A standard workshop cannot service an EV safely. As EV penetration grows in Malaysia (Proton's EV lineup, BYD dominance in 2025–2026), the platform needs a clear way to surface EV-capable workshops before customers start asking. Being first to category-tag EV workshops creates a defensible database advantage.

### Implementation outline
- **Workshop model:** add `ev_certified: bool` and `ev_brands: [str]` (e.g. `["BYD", "Tesla", "Proton"]`)
- **Service model:** add `service_type: "ev" | "ice" | "both"` tag on each service
- **Mechanic model:** add `ev_certified: bool` flag (already has `specialty` field — extend it)
- **Explore filter:** add "EV Certified" chip alongside existing service filters
- **WorkshopDetail:** show EV badge + supported brands if `ev_certified` is true
- **Booking validation:** if customer's vehicle `fuel_type === "electric"` and selected workshop is not `ev_certified`, show a warning before confirming

### Related notes
- [[Data Models]] — workshop, service, mechanic, vehicle schemas
- [[Features]] — Workshop Discovery filters
- [[Frontend]] — Explore filter chips

---

## Bengkil Lah Wallet

**Status:** ❌ Not implemented

An in-app prepaid wallet. Customers top up via FPX or card, use the balance to pay for bookings. Wallet payments earn loyalty points at 1.5× rate (vs 1× for card). Workshop payouts go to their wallet first, then withdraw to bank.

### Why
A closed-loop wallet dramatically improves unit economics: float earns interest, payout delays give the platform working capital, and the loyalty multiplier nudges customers to top up (increasing retention). In Malaysia, e-wallet familiarity is extremely high (Touch 'n Go, GrabPay) — users are comfortable with the concept.

### Implementation outline
- **New collection:** `wallets` — `{owner_id, owner_type: "customer"|"workshop", balance_rm, currency: "MYR", transactions: []}`
- **Top-up:** customer initiates FPX payment via Billplz or Stripe (FPX is natively supported by Stripe in MY) → on webhook success, credit wallet
- **Payment flow:** booking creation checks `payment_method: "wallet"` → deduct from wallet atomically (MongoDB transaction) → no Stripe needed for that booking
- **Workshop payout:** on booking completion, credit workshop wallet minus platform commission. Workshop taps "Withdraw" → triggers Stripe Connect payout or DuitNow transfer.
- **Loyalty multiplier:** `awarded_points = amount_rm * 1.5` when `payment_method === "wallet"` (vs `* 1.0` for card)

### Revenue impact
Float on customer top-ups + reduced Stripe fees on wallet-to-wallet transactions + interchange on FPX top-ups.

### Regulatory note
Offering a stored-value facility (SVF) in Malaysia requires a Bank Negara licence (or partnership with a licensed e-money issuer like TNG Digital). Build the wallet infrastructure now; activate only after licensing or via a licensed partner's API.

### Related notes
- [[Features]] — Loyalty Points System, Stripe payments
- [[Data Models]] — new `wallets` collection
- [[Backend]] — payments router

---

## Workshop Photo Gallery (Categorised)

**Status:** ✅ Complete

> Note: basic image upload and a flat carousel on WorkshopDetail are already complete (see [[Features]] — Workshop Profile). This feature adds **category tagging** so customers can browse photos by type before deciding whether to book.

Vendors tag each uploaded photo with a category — exterior, reception, lift bays, equipment, waiting area. Customers see a filterable gallery on WorkshopDetail so they can judge whether the workshop has the right kit for their job (e.g. "do they have an alignment machine?").

### Why
A customer booking a wheel alignment or suspension work wants to know the workshop has a proper alignment rack. Right now all images are in one flat array. Category tags let customers self-qualify, which reduces the "I didn't know it was that kind of workshop" complaints and increases trust for higher-ticket jobs.

### Data model change
Current: `workshop.images: [str]` (list of URL strings)
New: `workshop.images: [{url: str, category: str, caption: str}]`

Categories: `exterior | reception | lift_bays | equipment | waiting_area | team | other`

Migration: existing images get `category: "other"` on write.

### Backend changes
- `PATCH /workshops/my` already handles image upload — extend to accept `{url, category, caption}` objects instead of bare strings
- `GET /workshops/{id}` — serializer groups images by category in response: `{images_by_category: {exterior: [...], equipment: [...]}}`

### Frontend changes
- **WorkshopDetail:** replace the flat `FlatList` carousel with a tabbed gallery. Category tabs across the top (only show tabs that have photos). Tapping any photo opens fullscreen viewer.
- **WorkshopProfile (vendor):** image upload modal adds a category picker and optional caption field before confirming upload.

### Related notes
- [[Features]] — Workshop Profile & Services, Workshop images carousel
- [[Data Models]] — workshop schema (`images` array structure)
- [[Frontend]] — `WorkshopDetailScreen`, `WorkshopProfileScreen`

---

## Service Duration Estimate

**Status:** ✅ Complete

> `duration_minutes` already exists on every service object in the backend (`models/workshop.py:16`, used in queue snapshot). It is never shown to the customer at booking time.

Show "~45 min" next to each service in `BookingScreen` and a total estimated time in the booking summary. Helps customers plan their day and reduces no-shows caused by underestimating how long the job takes.

### Why it matters
A customer who books an oil change expecting 20 minutes and finds it takes 1.5 hours is an unhappy customer. Displaying the estimate upfront sets expectations, reduces mid-service check-in calls ("is my car ready?"), and is a direct input to the real-time queue feature already live.

### What needs to be built (frontend only)

**BookingScreen (`src/screens/customer/BookingScreen`):**
- Each service row already shows name and price — add `· ~{duration_minutes} min` after the price
- Booking summary card at the bottom: add "Estimated duration: {total_minutes} min" line, summed across all selected services

**WorkshopDetail (`src/screens/customer/WorkshopDetail`):**
- Service list rows: same `· ~X min` label

**WorkshopProfile (vendor) — `ServiceManagement`:**
- Duration field is already editable (field exists in model). Confirm it's wired to the edit form; if not, add a number input for it.

No backend changes needed — `duration_minutes` is already returned in the workshop/services API response.

### Related notes
- [[Frontend]] — `BookingScreen`, `WorkshopDetailScreen`, `ServiceManagementScreen`
- [[Features]] — Real-time queue / wait time (already consumes `duration_minutes`)

---

## Book a Service for Someone Else

**Status:** ✅ Complete

A logged-in customer books a service on behalf of a family member or friend — different name, phone number, and car — without requiring that person to have an account.

### Why
Parents booking for adult children, spouses handling each other's cars, PAs booking for executives. This is a common real-world pattern that currently requires the other person to register and log in, which kills the convenience. A "guest vehicle" option at checkout handles it with no new account required.

### How it works

At checkout in `BookingScreen`, add a "Booking for someone else?" toggle. When on:
- **Contact name** — free text, who the workshop should call (not the logged-in user)
- **Contact phone** — their phone number
- **Vehicle** — a one-time entry (plate, make, model) that is NOT saved to the booker's vehicle list unless they opt in

The booking is stored under the logged-in customer's `customer_id` for payment and history, but `contact_name` and `contact_phone` override the default on the workshop side.

### Data model additions (booking document)
```json
{
  "booked_for_other": true,
  "guest_contact_name":  "Ayah",
  "guest_contact_phone": "0123456789",
  "guest_vehicle": { "plate": "WXY 1234", "make": "Proton", "model": "Saga", "year": 2019 }
}
```

### Backend changes
- `POST /bookings/` — accept the three optional `guest_*` fields; if present, use them in the serialized booking response instead of the customer's own name/phone
- Workshop-facing booking detail shows "Booked by: Ali (on behalf of Ayah — 012-345-6789)"
- No new collection needed

### Frontend changes
- `BookingScreen`: toggle → conditional form fields for name, phone, vehicle
- `WorkshopBookingDetailScreen`: display "On behalf of" label when `booked_for_other: true`
- `BookingDetailScreen` (customer): show "Booked for: Ayah" label

### Related notes
- [[Booking Flow]] — no status changes, purely additional metadata
- [[Data Models]] — booking schema
- [[Frontend]] — `BookingScreen`

---

## Dark / Light Mode

**Status:** ✅ Complete

A toggle in Settings that switches the app between dark mode (current default) and light mode. Respects the system setting on first launch.

### Why
The app is hardcoded to dark mode today (`background: var(--dark)` throughout). React Native's `Appearance` API and `useColorScheme()` hook make this straightforward to implement — the main cost is threading a theme context through the component tree, not designing new screens from scratch. Light mode matters for daytime outdoor use (direct sunlight washes out dark interfaces on phone screens).

### Implementation outline

**Theme file (`src/utils/theme.ts`):**
- Define a `lightTheme` and `darkTheme` object, each containing the same keys as the current `Colors` export
- `getTheme(scheme: 'light' | 'dark') => Theme`

**Theme context (`src/contexts/ThemeContext.tsx`):**
- `ThemeProvider` wraps the app in `RootNavigator`. Reads `AsyncStorage` for saved preference, falls back to `Appearance.getColorScheme()`
- `useTheme()` hook — every screen calls this instead of importing `Colors` directly
- Saves user's manual choice to `AsyncStorage` key `"theme_preference"`

**Redux or context:** context is sufficient — theme is not server state.

**Settings screen (`src/screens/shared/Profile`):**
- Add a "Appearance" row with a three-way toggle: System / Light / Dark

**Scope:** all screens use `useTheme()` for background, card, text, and muted colours. The current `theme.ts` constants become the dark defaults.

### Related notes
- [[Frontend]] — `src/utils/theme.ts`, `RootNavigator`, Profile/Settings screen

---

## Multi-language Support (BM + English)

**Status:** ✅ Complete

Users can switch the app's UI language between English and Bahasa Malaysia (BM). Defaults to BM if the device locale is `ms-MY`, otherwise English.

### Why
Bengkil Lah targets the Malaysian mass market. A significant portion of workshop owners and customers are more comfortable in BM — especially older demographics and those outside the Klang Valley. English-only is a ceiling on total addressable users. BM is also the language of government compliance (road tax, Puspakom), making it natural for those features. Adding Mandarin as a third language in a future phase would reach the Chinese-Malaysian segment.

### Library
`i18next` + `react-i18next` + `expo-localization`. Well-documented, works on React Native and web.

```
npm install i18next react-i18next expo-localization
```

### File structure
```
src/
  i18n/
    index.ts        — initialise i18next, detect locale
    locales/
      en.json       — English strings
      ms.json       — Bahasa Malaysia strings
```

### Integration pattern
```tsx
// Before
<Text>Book Now</Text>

// After
const { t } = useTranslation();
<Text>{t('booking.bookNow')}</Text>
```

### Rollout strategy
1. Extract all user-visible strings to `en.json` (mechanical, no design decisions)
2. Translate to `ms.json` — can use a freelancer or DeepL for a first pass, then review with a native speaker
3. Add language picker in Settings (same screen as the dark/light mode toggle)
4. Store choice in `AsyncStorage` key `"language_preference"`

### Scope notes
- Backend error messages returned in the API response should also be translatable — return error codes (`ERR_SLOT_FULL`) rather than English sentences, and translate on the frontend
- Dates and currency (RM) formatting already works for MY locale via standard `Intl` APIs

### Related notes
- [[Frontend]] — all screen files need string extraction
- [[Dev Setup]] — add `expo-localization` to known dependencies
