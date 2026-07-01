# Bengkil Lah — Car Service Booking App

A full-stack car service booking platform connecting **car owners** with **workshop vendors**.

## Project Structure

```
booking/
├── backend/          FastAPI + MongoDB + Socket.io
│   ├── core/         Database, security, socket manager
│   ├── middleware/   JWT auth middleware
│   ├── models/       Pydantic schemas
│   ├── routers/      API route handlers
│   ├── main.py       App entry point
│   ├── seed.py       Dummy data loader
│   └── requirements.txt
├── mobile/           Expo React Native (web build)
│   ├── src/
│   │   ├── navigation/   React Navigation setup
│   │   ├── screens/      All app screens
│   │   ├── services/     API, socket, storage
│   │   ├── store/        Redux Toolkit slices
│   │   └── utils/        Theme, helpers
│   └── dist/         Built web output (served by `npx serve`)
├── start-all.sh      One-command startup script
└── README.md
```

## Quick Start

> Run all commands from the **`booking/`** root directory.

```bash
cd /home/penyahpepijat/claude/bengkil-Lah/booking
bash start-all.sh
```

This will:
1. Start MongoDB on port 27017
2. Start FastAPI backend on **http://localhost:8000**
3. Build the Expo web app into `mobile/dist/` (~30s)
4. Serve the web app on **http://localhost:8081**
5. Serve the pitch deck on **http://localhost:8082**
6. Start the Cloudflare Tunnel (makes the app publicly accessible)

Press `Ctrl+C` to stop all services.

---

## 🔄 Restart After Laptop Shutdown

> Everything below is needed to get `https://bengkil-lah.percubaan.com` back online.

### Step 1 — Run the startup script

```bash
cd /home/penyahpepijat/claude/bengkil-Lah/booking
bash start-all.sh
```

This handles MongoDB → Backend → Web app → Pitch deck → Cloudflare Tunnel in one go. Wait for the output to show:

```
✓ MongoDB started
✓ Backend running   → http://localhost:8000
✓ Build complete
✓ Mobile app running → http://localhost:8081
✓ Pitch deck running → http://localhost:8082
✓ Tunnel started    → https://bengkil-lah.percubaan.com
```

### Step 2 — Verify the public URLs are live

```bash
curl -s -o /dev/null -w "Web app: %{http_code}\n" https://bengkil-lah.percubaan.com/
curl -s -o /dev/null -w "API:     %{http_code}\n" https://bengkil-lah-api.percubaan.com/health
curl -s -o /dev/null -w "Pitch:   %{http_code}\n" https://pitch.percubaan.com/
```

All three should return `200`.

### Step 3 (if code changed) — Rebuild the web app

If you made changes to `mobile/src/` since the last build, rebuild before serving:

```bash
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /home/penyahpepijat/claude/bengkil-Lah/booking/mobile
CI=1 npx expo export --platform web
```

Then hard-refresh the browser (`Ctrl+Shift+R`) — the already-running `npx serve` process picks up the new `dist/` automatically.

---

### What each service does

| Service | Port | Command | Public URL |
|---------|------|---------|-----------|
| MongoDB | 27017 | `~/mongodb/bin/mongod --fork ...` | local only |
| FastAPI backend | 8000 | `/var/data/python/bin/uvicorn main:socket_app` | `https://bengkil-lah-api.percubaan.com` |
| Expo web app | 8081 | `npx serve dist -p 8081` | `https://bengkil-lah.percubaan.com` |
| Pitch deck | 8082 | `npx serve pitch-serve -p 8082` | `https://pitch.percubaan.com` |
| Cloudflare Tunnel | — | `~/.local/bin/cloudflared tunnel run percubaan-tunnel` | routes 8081/8082/8000 → public |

> The Cloudflare Tunnel is the critical piece — without it, the public URLs return 502. The tunnel config lives at `~/.cloudflared/config.yml`.

### Logs

```bash
tail -f /tmp/backend.log       # FastAPI backend
tail -f /tmp/expo.log          # web app server
tail -f /tmp/pitch-serve.log   # pitch deck server
tail -f /tmp/cloudflared.log   # Cloudflare tunnel
```

---

## Requirements (this environment)

| Requirement | Location |
|-------------|----------|
| MongoDB binary | `~/mongodb/bin/mongod` |
| MongoDB data | `~/mongodb/data/` |
| Python 3.13 | `/usr/bin/python3` |
| uvicorn | `/var/data/python/bin/uvicorn` |
| Node.js 22 (via nvm) | `~/.var/app/com.visualstudio.code/config/nvm` |

## Seed / Dummy Data

Load test data into MongoDB (backend must be running):

```bash
cd backend
python3 seed.py
```

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | ahmad@example.com | password123 |
| Customer | siti@example.com | password123 |
| Workshop | hafiz@workshop.com | password123 |
| Workshop | ken@workshop.com | password123 |
| Workshop | razif@workshop.com | password123 |

## Features

### Customer (Car Owner)
- Browse nearby workshops on map + list view
- Filter by service category (Oil Change, Tire, Brake, Engine, etc.)
- View workshop details, services, and reviews
- Price Estimator — pick symptoms ("squeaky brakes", "AC not cold") and get an estimated price range from nearby workshops before booking
- Book services with date/time picker
- Track booking status in real-time
- In-app chat with workshop
- Review and approve/reject itemized quotations from the workshop before any extra charge is added to the total; download an approved quotation as a branded PDF
- Pay after workshop completes service; booking detail shows a full price breakdown (subtotal, promotion/referral/loyalty discounts, final total)
- Leave a rating and review
- Manage vehicles (plate, model, year, color) — auto-synced from booking history
- Edit profile (single active session — logging in on a new device signs out other devices)

### Workshop Vendor
- Dashboard with stats (pending, today's jobs, revenue)
- Accept / reject / complete booking requests
- Manage services (add, edit, delete with pricing)
- Real-time chat with customers
- Booking history with filters

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile/Web | Expo 51 (React Native + Metro web build) |
| Navigation | React Navigation v6 (stack + bottom tabs) |
| State | Redux Toolkit |
| Backend | FastAPI (Python 3.13) |
| Database | MongoDB 8 (Motor async driver) |
| Real-time | Socket.io (python-socketio) |
| Payments | Stripe mock (real integration ready) |
| Auth | JWT Bearer tokens + bcrypt |

## API Endpoints

Full interactive docs at **http://localhost:8000/docs**

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/register/customer | Register customer |
| POST | /api/v1/auth/register/workshop | Register workshop |
| POST | /api/v1/auth/login | Login (returns JWT) |
| GET | /api/v1/users/me | Get current user |
| PATCH | /api/v1/users/me | Update profile |
| GET | /api/v1/workshops/nearby | Find nearby workshops |
| GET | /api/v1/workshops/{id} | Workshop details |
| PATCH | /api/v1/workshops/my/profile | Update workshop profile |
| POST | /api/v1/workshops/my/services | Add service |
| PATCH | /api/v1/workshops/my/services/{id} | Edit service |
| DELETE | /api/v1/workshops/my/services/{id} | Delete service |
| POST | /api/v1/bookings/ | Create booking |
| GET | /api/v1/bookings/my | My bookings (customer) |
| GET | /api/v1/bookings/workshop | Workshop bookings |
| PATCH | /api/v1/bookings/{id}/status | Update booking status |
| GET | /api/v1/chat/{bookingId}/messages | Get chat messages |
| POST | /api/v1/chat/{bookingId}/messages | Send message |
| POST | /api/v1/reviews/ | Submit review |
| POST | /api/v1/payments/create-intent/{bookingId} | Create payment |
| POST | /api/v1/payments/confirm/{bookingId} | Confirm payment |
| POST | /api/v1/bookings/{bookingId}/quotations | Workshop sends itemized quote |
| PATCH | /api/v1/bookings/{bookingId}/quotations/{quotationId}/respond | Customer approves/rejects quote |
| GET | /api/v1/bookings/{bookingId}/quotations/{quotationId}/pdf | Download approved quotation as PDF |
| GET | /api/v1/price-estimator/symptoms | List symptom catalog |
| POST | /api/v1/price-estimator/estimate | Get price range estimate for selected symptoms near a location |

## Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Client → Server | Authenticate with JWT token |
| `join_booking` | Client → Server | Join booking chat room |
| `new_message` | Server → Client | Incoming chat message |
| `new_booking` | Server → Client | New booking alert (workshop) |
| `booking_status_updated` | Server → Client | Booking status changed |

## Stripe Integration

Payment runs in **mock mode** by default (no real charge).  
To enable real Stripe, add to `backend/.env`:

```
STRIPE_SECRET_KEY=sk_live_your_key_here
```

## Public Deployment

The app is exposed publicly via Cloudflare Tunnel:

| URL | Service |
|-----|---------|
| `https://bengkil-lah.percubaan.com` | Web app (`localhost:8081`) |
| `https://bengkil-lah-api.percubaan.com` | FastAPI backend (`localhost:8000`) |
| `https://pitch.percubaan.com` | Investor pitch deck (`localhost:8082`) |

Both the web app and pitch deck are served with `npx serve` (gzip compression, caching headers, security headers via `serve.json`), with SEO/Open Graph meta tags and a favicon. See `Bengkil-Lah/Dev Setup.md` (Obsidian vault) for tunnel management.

## Troubleshooting

**`start-all.sh: No such file or directory`**  
You are inside `backend/`. Go up one level:
```bash
cd ..
bash start-all.sh
```

**Backend 500 on register/login**  
Check `/tmp/backend.log`. Common cause: bcrypt/passlib version mismatch — already fixed in `core/security.py` to use `bcrypt` directly.

**App not updating after code changes**  
Re-run the build then restart serve:
```bash
cd mobile
CI=1 npx expo export --platform web
npx serve dist -p 8081
```
