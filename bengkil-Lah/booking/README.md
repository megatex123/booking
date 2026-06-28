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
cd /path/to/booking
bash start-all.sh
```

This will:
1. Start MongoDB (if not already running)
2. Start FastAPI backend on **http://localhost:8000**
3. Build the web app (~30s first time)
4. Serve the app on **http://localhost:8081**

Press `Ctrl+C` to stop all services.

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
- Book services with date/time picker
- Track booking status in real-time
- In-app chat with workshop
- Pay after workshop completes service
- Leave a rating and review
- Manage vehicles (plate, model, year, color)
- Edit profile

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
