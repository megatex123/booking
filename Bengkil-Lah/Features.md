# Features

Status of every major feature in the app.

## Auth & Users

| Feature | Status | Notes |
|---|---|---|
| Customer registration | ✅ Complete | Includes optional address field |
| Workshop registration | ✅ Complete | Creates user + workshop record |
| Login (JWT) | ✅ Complete | |
| Token persistence (AsyncStorage) | ✅ Complete | |
| Edit profile / avatar | ✅ Complete | Photo upload via `/uploads/` (open to all roles); address field editable |
| Change password | ✅ Complete | |
| Forgot password (OTP) | ✅ Complete | Screens + backend wired; depends on SMTP in `.env` |
| Online status indicator | ✅ Complete | Socket.IO `connected_users` map |
| Single-device login (customers) | ✅ Complete | `session_id` embedded in JWT, validated per-request; logging in elsewhere signs out other devices with an in-app alert. Workshop accounts unaffected. |

## Customer — Workshop Discovery

| Feature | Status | Notes |
|---|---|---|
| Explore nearby workshops | ✅ Complete | Geospatial `$near` query |
| Filter by service category | ✅ Complete | Query param on `/workshops/nearby` |
| Workshop detail page | ✅ Complete | Services, hours, images, reviews, map |
| Map view | ⚠️ Web stub | `react-native-maps` mocked; renders blank |
| List view | ✅ Complete | Default on web |
| Workshop images carousel | ✅ Complete | |
| Favourite workshops | ✅ Complete | Heart icon on cards + WorkshopDetail; favourites pinned to top of Explore list; persisted via AsyncStorage (`favourite_workshop_ids`) |
| Price comparison | ✅ Complete | "Compare" chip on cards + WorkshopDetail; floating compare tray (max 3); full side-by-side table in `CompareScreen` with per-category pricing |
| Real-time queue / wait time | ✅ Complete | `compute_queue_snapshot()` in `workshops.py` — triggered on `in_progress`/`completed` transitions, cached in `workshop.queue_snapshot`; wait badge on Explore cards; full queue card on WorkshopDetail with Refresh button (`GET /workshops/{id}/queue`); panel filter chip |
| Loyalty Points System | ✅ Complete | Earn 1 pt per RM1 spent (awarded on `completed`); 100 pts = RM1 discount; redeem at booking creation; balance visible in Profile → Loyalty Points; `LoyaltyScreen` with history; `GET /loyalty/balance`, `GET /loyalty/history` |
| Workshop Promotions & Flash Deals | ✅ Complete | Embedded in workshop doc; serializer filters active/non-expired; 🔥 badge on Explore cards and "Current Deals" section in WorkshopDetail; `WorkshopPromotionsScreen` for vendor CRUD; `GET/POST/PATCH/DELETE /workshops/my/promotions`; custom inline calendar date/time picker (no native browser input) |
| Price Estimator | ✅ Complete | Customer picks symptoms ("squeaky brakes", "AC not cold") → estimated price range from nearby workshops before booking; `PriceEstimatorScreen`, banner entry point on Explore (list mode); `GET /price-estimator/symptoms`, `POST /price-estimator/estimate` |

## Customer — Booking

| Feature | Status | Notes |
|---|---|---|
| Select services & book | ✅ Complete | Multi-service, price computed server-side |
| Vehicle info input | ✅ Complete | Plate, name, brand |
| Booking notes | ✅ Complete | |
| Booking success screen | ✅ Complete | |
| View booking history | ✅ Complete | Filterable by status |
| Booking detail | ✅ Complete | Full info, status badge, actions |
| Cancel booking | ✅ Complete | Pending / confirmed only |
| Reschedule booking | ✅ Complete | Pending / confirmed only |
| Real-time status updates | ✅ Complete | Socket.IO `booking_status_updated` |
| Quotation approval before charge | ✅ Complete | Workshop sends itemized quote (`initial` while pending/confirmed, pre-filled from the customer's selected services; `additional` while in_progress for extra work found, starts blank); customer must approve before the amount is added to the total — nothing auto-charged. `POST /bookings/{id}/quotations`, `PATCH /bookings/{id}/quotations/{qid}/respond`; UI in both `WorkshopBookingDetailScreen` (send) and `BookingDetailScreen` (approve/reject) |
| Promotion + loyalty discount on quotations | ✅ Complete | When approving a quotation, the best active workshop promotion is auto-applied and the customer can toggle "Use loyalty points" — same discount math as booking creation. Final discounted amount (not raw subtotal) is added to the booking total; breakdown shown on the approved quotation card and in the downloadable PDF |
| Quotation PDF download | ✅ Complete | Once a quotation is approved, customer or workshop can download a branded PDF via `GET /bookings/{id}/quotations/{qid}/pdf`; "Print / Download PDF" button on the approved quotation card in `BookingDetailScreen` |

## Customer — Payments

| Feature | Status | Notes |
|---|---|---|
| Stripe PaymentIntent (backend) | ✅ Complete | |
| Payment UI (web) | ⚠️ Stub | Stripe SDK mocked; no real card capture on web |
| Manual payment confirm (API) | ✅ Complete | `POST /payments/confirm/{id}` works directly |
| PDF Invoice download | ✅ Complete | `GET /bookings/{id}/invoice` — branded 2-page PDF via fpdf2; "Download Invoice" button on completed bookings (web) |
| Price breakdown on booking detail | ✅ Complete | When any discount applies, shows subtotal (strikethrough) + itemised promotion/referral/loyalty discounts + final total on `BookingDetailScreen` |

## Customer — Reviews

| Feature | Status | Notes |
|---|---|---|
| Leave review (post completion) | ✅ Complete | 1–5 stars + comment |
| View my reviews | ✅ Complete | `MyReviewsScreen` |
| View workshop reviews | ✅ Complete | On workshop detail page |

## Customer — Vehicles

| Feature | Status | Notes |
|---|---|---|
| My Vehicles list | ✅ Complete | Saved to `users.vehicles` in MongoDB via `PATCH /users/me`; `MyVehiclesScreen` fields: Plate, Brand, Model Name, Year, Color; pencil icon on each card opens inline edit form with all fields editable (including plate number); `GET /users/me/vehicles` also merges in vehicle plates from booking history not yet in `users.vehicles`, and new bookings auto-add their vehicle so the list stays in sync |
| Vehicle service history | ✅ Complete | Unified timeline: completed bookings + self-logged manual entries merged chronologically; workshop bookings (blue) vs manual logs (amber/wrench icon); supports edit & delete of manual entries |
| Manual service logging | ✅ Complete | Customers can self-log services done outside the app (DIY, local mechanic, any workshop); `POST /service-logs/`; `manual_service_logs` MongoDB collection; form: date, location, services (comma list + quick-pick chips), notes, mileage, cost, next service interval |
| Car Health Score | ✅ Complete | Score (0–100) per vehicle based on elapsed time since last service vs. next service interval; `GET /bookings/vehicle-health`; merges completed bookings AND manual logs — uses whichever record is most recent; `CarHealthScreen` with SVG circular gauge; dashboard widget on `CustomerDashboardScreen`; fleet average banner |

## Workshop — Dashboard

| Feature | Status | Notes |
|---|---|---|
| Today's bookings count | ✅ Complete | |
| Pending / in-progress stats | ✅ Complete | |
| Recent bookings list | ✅ Complete | |
| Quick navigation to management | ✅ Complete | |
| Revenue & Analytics dashboard | ✅ Complete | `AnalyticsDashboardScreen` — monthly revenue bars, peak-hour bars, top-services list, customer repeat/new split; fetches `GET /workshops/my/analytics?months=N` (3M/6M/12M toggle) |

## Workshop — Booking Management

| Feature | Status | Notes |
|---|---|---|
| View all bookings | ✅ Complete | Filterable by status |
| Confirm booking | ✅ Complete | |
| Reject booking (with reason) | ✅ Complete | `status_note` stored |
| Mark in-progress | ✅ Complete | |
| Mark completed (general notes) | ✅ Complete | |
| Mark completed (per-service reports) | ✅ Complete | Each report supports work-done notes, next-service recommendation, products used, and photo/video upload (web file picker fixed — `expo-image-picker` mock now opens a real `<input type="file">` instead of always cancelling) |
| Assign repair station | ✅ Complete | |
| Real-time new booking alert | ✅ Complete | Socket.IO `new_booking` |

## Workshop — Profile & Services

| Feature | Status | Notes |
|---|---|---|
| Edit workshop profile | ✅ Complete | Name, address, description, hours, images |
| Add / edit / delete services | ✅ Complete | |
| Service default products | ✅ Complete | Pre-populates products_used on completion |
| Upload workshop images | ✅ Complete | |
| Working hours per day | ✅ Complete | |

## Workshop — Inventory (Products)

| Feature | Status | Notes |
|---|---|---|
| Add / edit / delete products | ✅ Complete | |
| Product categories | ✅ Complete | lubricant, brake, filter, tyre, etc. |
| Stock quantity tracking | ✅ Complete | |
| Auto-deduct on booking completion | ✅ Complete | Via `service_reports.products_used` |
| Service tags on products | ✅ Complete | Helps pre-suggest products for a service |
| Reorder alert threshold | ✅ Complete | Per-product `reorder_threshold` field; notification fired after deduction if qty ≤ threshold |

## Workshop — Customer CRM

| Feature | Status | Notes |
|---|---|---|
| Customer list with visit + spend data | ✅ Complete | `GET /workshops/my/customers` — screen: `CustomerCRMScreen` |
| Search by name / phone | ✅ Complete | Client-side filter |
| Sort by recent / top spender / most visits | ✅ Complete | Client-side sort |
| Summary stats (total customers, revenue, avg spend) | ✅ Complete | Computed from API response |
| Vehicle list per customer (max 2 + overflow) | ✅ Complete | |

## Workshop — Repair Stations

| Feature | Status | Notes |
|---|---|---|
| Add / edit / delete stations | ✅ Complete | |
| Assign booking to station | ✅ Complete | |
| Visual layout screen | ✅ Complete | `WorkshopLayoutScreen` |

## Workshop — Mechanics (Staff)

| Feature | Status | Notes |
|---|---|---|
| Add / edit mechanics | ✅ Complete | `MechanicManagementScreen` — name, phone, specialty |
| Activate / deactivate mechanic | ✅ Complete | Toggle button on card + Is Active switch in edit modal |
| Workload stats display | ✅ Complete | Shows `bookings_count` and `completed_count` per mechanic |
| Backend CRUD endpoints | ✅ Complete | `GET/POST/PATCH/DELETE /workshops/my/mechanics`; `PATCH /bookings/{id}/mechanic` |
| Assign mechanic to booking | ✅ Complete | Grid selector in `WorkshopBookingDetailScreen` (pending/confirmed/in_progress) |
| Revenue & Analytics dashboard | ✅ Complete | `AnalyticsDashboardScreen` — monthly revenue bars, peak hours, top services, repeat vs new |

## Platform / Business Features

### Referral System

| Feature | Status | Notes |
|---|---|---|
| Unique referral code per customer | ✅ Complete | Auto-generated (6-char alphanumeric) on registration |
| Validate code before booking | ✅ Complete | `POST /referrals/validate` — checks owner, not already used |
| Referral discount (10%, max RM50) | ✅ Complete | Applied in booking creation; shown in BookingScreen summary |
| RM20 reward credit on completion | ✅ Complete | Credited to referrer when referee's booking is marked completed |
| Referral history screen | ✅ Complete | `ReferralScreen` — code display, copy, stats, history |
| Credits auto-applied at checkout | ⚠️ Display only | Credit balance shown; not yet auto-deducted server-side |

### Fleet / Corporate Accounts

| Feature | Status | Notes |
|---|---|---|
| Corporate account registration | ✅ Complete | `CorporateRegistrationScreen` + `POST /corporate/register` |
| Fleet vehicle management (CRUD) | ✅ Complete | Admin adds/edits/removes fleet vehicles |
| Driver management (invite by email) | ✅ Complete | Links existing customer accounts as drivers |
| Corporate billing toggle on booking | ✅ Complete | `payment_type: "corporate"` in BookingScreen |
| Monthly billing summary | ✅ Complete | `GET /corporate/billing?month=YYYY-MM` — total, paid, pending |
| Corporate billing screen | ✅ Complete | `CorporateManagementScreen` — vehicles/drivers/billing tabs |
| Monthly invoice PDF | ❌ Not implemented | Future: generate monthly PDF statement |

### Insurance Claim Integration

| Feature | Status | Notes |
|---|---|---|
| Panel workshop configuration | ✅ Complete | `WorkshopPanelSettingsScreen` + `PATCH /workshops/my/panel` |
| Panel filter chip on Explore | ✅ Complete | Client-side filter — toggles `panelOnly` state |
| Panel provider badges on WorkshopDetail | ✅ Complete | Shows insurer logos/names below address |
| Insurance claim toggle in BookingScreen | ✅ Complete | `payment_type: "insurance"` + provider + policy no + incident date |
| Claim status tracking (customer) | ✅ Complete | Claim card in `BookingDetailScreen` with status badge |
| Claim status update (workshop) | ✅ Complete | `WorkshopBookingDetailScreen` — modal to update submitted/processing/approved/rejected |
| Push notification on claim update | ✅ Complete | `insurance_claim_update` notification type |
| Adjuster integration / real panel API | ❌ Not implemented | Would require direct API from insurers (Takaful, Etiqa, etc.) |

## Branding

| Feature | Status | Notes |
|---|---|---|
| Enigma Code Solution footer | ✅ Complete | Global footer bar (`EnigmaFooter` in `App.tsx`, `ENIGMA_FOOTER_HEIGHT = 22`); both tab navigators offset tab bar by `marginBottom: ENIGMA_FOOTER_HEIGHT`; logo at `src/assets/enigma-logo.jpg` |

## Shared Features

| Feature | Status | Notes |
|---|---|---|
| Workshop photo gallery (categorised) | ✅ Complete | `WorkshopImage` model with category + caption; paged gallery + category filter chips on `WorkshopDetailScreen`; vendor upload in `WorkshopProfileScreen` |
| Service duration estimate | ✅ Complete | `duration_minutes` shown as `~X min` on service rows in `BookingScreen` and `WorkshopDetailScreen` |
| Book-for-others | ✅ Complete | Toggle in `BookingScreen`; `booked_for_other`, `guest_contact_name/phone`, `guest_vehicle` stored on booking |
| Dark / Light mode | ✅ Complete | `ThemeContext` + `useTheme` hook; 3-way toggle (System / Light / Dark) in `ProfileScreen`; preference persisted to `AsyncStorage` |
| Multi-language BM + English | ✅ Complete | `i18next` + `react-i18next`; `en.json` + `ms.json`; language picker in `ProfileScreen`; `t()` wired in ProfileScreen, HomeScreen, WorkshopDetailScreen |
| In-app notifications | ✅ Complete | Persisted to DB + Socket.IO push |
| Notification badge (ShakingBell) | ✅ Complete | Unread count from API |
| Chat (booking-scoped) | ✅ Complete | REST history + Socket.IO realtime |
| Chat read receipts | ✅ Complete | `is_read` field |
| Smart service reminders | ✅ Complete | APScheduler runs daily at 09:00 UTC; sends one in-app reminder per completed booking when next service is ≤7 days away. Manual trigger: `POST /api/v1/notifications/reminders/run` |
| Help & Support screen | ✅ Complete | Static content |
| Privacy Policy screen | ✅ Complete | Static content |

## Legend
- ✅ Complete — fully wired frontend to backend
- ⚠️ Web stub — works natively, mocked/non-functional on web build

## Related Notes
- [[Booking Flow]] — lifecycle detail
- [[Frontend]] — web gotchas and mock packages
- [[Dev Setup]] — known issues
- [[Future Features]] — planned but not yet implemented (car pickup & delivery, WhatsApp, AI advisor, quote bidding, OCR, job card QR, parts marketplace, supplier POs, JPJ reminder, EV support, wallet)
