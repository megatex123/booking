# Bengkil Lah — Car Service Booking App

---

## Standing Orders: Obsidian Vault

The folder `Bengkil-Lah/` at the project root is an **Obsidian vault**. It is the living documentation for this project.

**Whenever you make a meaningful change to the codebase, you must also update the relevant vault note(s).** Treat the vault as the source of truth for project understanding.

### Which note covers what

| Changed area | Note to update |
|---|---|
| New router, endpoint, or auth rule | `Bengkil-Lah/Backend.md` + `Bengkil-Lah/API Reference.md` |
| New screen, navigator change, or UI pattern | `Bengkil-Lah/Frontend.md` |
| New MongoDB collection field or Pydantic model | `Bengkil-Lah/Data Models.md` |
| Booking status transition or business rule change | `Bengkil-Lah/Booking Flow.md` |
| New Socket.IO event or real-time behaviour | `Bengkil-Lah/Realtime.md` |
| New feature, or feature status changes | `Bengkil-Lah/Features.md` |
| Dev environment or known issue changes | `Bengkil-Lah/Dev Setup.md` |
| Major architectural shift | `Bengkil-Lah/Architecture.md` |

### Rules for editing vault notes

1. **Use Obsidian wiki-links** (`[[Note Name]]`) when referencing another note — never plain text or file paths.
2. **Do not duplicate content** across notes — link instead.
3. **Keep tables accurate** — if you add an endpoint, add its row to `API Reference.md`. If you remove one, remove the row.
4. **Feature status** in `Features.md` must reflect reality: ✅ Complete, ⚠️ Web stub, or ❌ Not implemented.
5. If you create a genuinely new area (a whole new subsystem), create a new note and link it from `🏠 Home.md`.

### At the start of a new conversation

Before doing any work, read the relevant vault note for context — it will give you faster orientation than re-reading all source files from scratch.

---

Full-stack mobile app (Expo + FastAPI + MongoDB) that connects **customers** with **workshop vendors** for car servicing. "Bengkil Lah" is Malay slang for "go to the workshop lah".

---

## Architecture

```
booking/
├── backend/        FastAPI + Motor (async MongoDB) + Socket.IO
├── mobile/         Expo 51 (React Native) — runs as web via expo export
└── start-all.sh    Starts MongoDB, backend, and serves the web build
```

Two user roles with completely separate navigator stacks:
- **Customer** — browse workshops, book services, pay, chat, review
- **Workshop Vendor** — manage profile/services, confirm/reject bookings, mark complete, view reviews

---

## Starting the Project

```bash
cd /home/penyahpepijat/claude/bengkil-Lah/booking
bash start-all.sh
```

- Backend → http://localhost:8000  (API docs at /docs)
- Web app → http://localhost:8081

**To rebuild only the web app after mobile changes:**
```bash
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd mobile && CI=1 npx expo export --platform web
```
Then hard-refresh the browser (Ctrl+Shift+R). The `npx serve dist -p 8081` process must already be running.

**Backend reloads automatically** (uvicorn `--reload` watches `backend/`).

---

## Backend

**Runtime:** `/var/data/python/bin/uvicorn main:socket_app`  
**MongoDB:** `~/mongodb/bin/mongod` — data at `~/mongodb/data`, port 27017, db `carbooking`

### Key files
| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app + Socket.IO ASGI wrapper (`socket_app`) |
| `backend/core/database.py` | Motor async MongoDB connection |
| `backend/core/socket_manager.py` | Socket.IO server, connected_users map, emit helpers |
| `backend/core/security.py` | JWT encode/decode, password hashing |
| `backend/middleware/auth.py` | `get_current_user`, `require_customer`, `require_workshop` |
| `backend/routers/bookings.py` | Booking CRUD + status transitions |
| `backend/routers/auth.py` | Register (customer/workshop) + login |
| `backend/routers/workshops.py` | Workshop listing, search, my-workshop CRUD |
| `backend/routers/reviews.py` | Create + fetch reviews |
| `backend/routers/chat.py` | REST messages + Socket.IO real-time chat |
| `backend/routers/payments.py` | Stripe payment intent |
| `backend/seed.py` | Seeds DB with 2 customers, 3 workshops, bookings, reviews |

### Booking status flow
```
pending → confirmed → in_progress → completed
        → rejected
confirmed → cancelled (customer only)
```
When marking `completed`, the workshop **must** provide:
- `completion_notes` (what work was done)
- `next_service_months` (1 / 3 / 6 / 12 / 24)

### Known Python issue
`passlib[bcrypt]` is incompatible with Python 3.13. Password hashing uses `import bcrypt; bcrypt.hashpw()` directly in `seed.py`. If `core/security.py` uses `pwd_context.hash()` it will 500 on registration.

### datetime serialization rule
`serialize_booking()` and `serialize_message()` must call `.isoformat()` on all `datetime` fields before returning — FastAPI's response serializer handles it automatically but Socket.IO's JSON encoder does not.

---

## Mobile (Expo)

**Node/npm via nvm:** `$HOME/.var/app/com.visualstudio.code/config/nvm`  
**API base URL:** `http://localhost:8000/api/v1` (hardcoded in `src/services/api.ts`)

### Key directories
| Path | Purpose |
|------|---------|
| `src/navigation/` | `CustomerNavigator.tsx`, `WorkshopNavigator.tsx`, `RootNavigator.tsx` |
| `src/screens/auth/` | Welcome, UserType, Login, Register |
| `src/screens/customer/` | Home (explore), BookingHistory, BookingDetail, BookingScreen, WorkshopDetail |
| `src/screens/workshop/` | Dashboard, WorkshopBookings, WorkshopBookingDetail, WorkshopProfile, WorkshopReviews, ServiceManagement |
| `src/screens/shared/` | Profile, EditProfile, Chat, Review, Payment, Notifications, HelpSupport, PrivacyPolicy |
| `src/store/` | Redux Toolkit slices: `authSlice`, `bookingSlice`, `workshopSlice` |
| `src/services/api.ts` | Axios instance + all API calls (`bookingAPI`, `workshopAPI`, `reviewAPI`, etc.) |
| `src/utils/theme.ts` | Colors, Typography, Spacing, BorderRadius, StatusColors |
| `src/utils/webAlert.ts` | `showAlert()` / `showConfirm()` — use these instead of `Alert.alert` (no-op on web) |
| `src/mocks/` | Web stubs for `react-native-maps`, `@stripe/stripe-react-native`, `expo-location` |
| `metro.config.js` | `resolveRequest` intercepts native-only packages on web platform |

### Web build gotchas
- `Alert.alert()` is a no-op on web — always use `showAlert()` / `showConfirm()` from `src/utils/webAlert.ts`
- `react-native-maps`, `@stripe/stripe-react-native`, `expo-location` are mocked for web via `metro.config.js`
- Default to list mode on web: `setMapMode(Platform.OS !== 'web')`
- Filter chip `ScrollView` must have `maxHeight: 44` and chips need `alignSelf: 'flex-start'` to prevent height stretching

### State management
Redux Toolkit with `createAsyncThunk`. Auth token stored in `AsyncStorage` (uses `localStorage` on web). Check rejected actions with `thunk.rejected.match(result)`.

---

## Test Accounts (after running seed.py)

| Role | Email | Password |
|------|-------|----------|
| Customer | ali@example.com | password123 |
| Customer | siti@example.com | password123 |
| Workshop | hafiz@workshop.com | password123 |
| Workshop | ken@workshop.com | password123 |
| Workshop | puan@workshop.com | password123 |

---

## API Endpoints (prefix: `/api/v1`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register/customer` | — | |
| POST | `/auth/register/workshop` | — | |
| POST | `/auth/login` | — | returns JWT |
| GET | `/workshops/` | — | search, filter, sort |
| GET | `/workshops/my` | Workshop | |
| PATCH | `/workshops/my` | Workshop | update profile |
| POST | `/bookings/` | Customer | create booking |
| GET | `/bookings/my` | Any | customer or workshop bookings |
| GET | `/bookings/{id}` | Any | |
| PATCH | `/bookings/{id}/status` | Workshop | confirm/reject/start/complete |
| PATCH | `/bookings/{id}/cancel` | Customer | |
| GET | `/chat/{booking_id}/messages` | Any | |
| POST | `/chat/{booking_id}/messages` | Any | |
| POST | `/reviews/` | Customer | booking must be completed |
| GET | `/reviews/workshop/{workshop_id}` | — | |
| POST | `/payments/create-intent` | Customer | Stripe |

---

## Socket.IO Events

| Event | Direction | Data |
|-------|-----------|------|
| `new_booking` | Server→Workshop | booking object |
| `booking_status_updated` | Server→Customer | booking object |
| `new_message` | Server→Room | message object |

Rooms are named `booking_{booking_id}`. Join with `join_booking` event.

---

## Logs & Debugging

```bash
tail -f /tmp/backend.log      # FastAPI/uvicorn
tail -f /tmp/expo-build.log   # Expo web build
tail -f /tmp/expo.log         # npx serve
```
