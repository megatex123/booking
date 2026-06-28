# Dev Setup

## Prerequisites

| Tool | Location |
|---|---|
| MongoDB | `~/mongodb/bin/mongod` — data at `~/mongodb/data` |
| Python 3.13 | `/var/data/python/bin/` |
| Node / npm (via nvm) | `$HOME/.var/app/com.visualstudio.code/config/nvm` |

## Start Everything

```bash
cd /home/penyahpepijat/claude/bengkil-Lah/booking
bash start-all.sh
```

What it does:
1. Starts MongoDB on port 27017 (forks if not already running)
2. Starts FastAPI + Socket.IO backend on port 8000 (`--reload` for hot-reload)
3. Builds Expo web export (`dist/`)
4. Serves built web app on port 8081 with `npx serve`

After startup:
- Backend API → `http://localhost:8000`
- API docs (Swagger) → `http://localhost:8000/docs`
- Web app → `http://localhost:8081`

## After Mobile Code Changes

No need to restart everything — just rebuild the web bundle:

```bash
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /home/penyahpepijat/claude/bengkil-Lah/booking/mobile
CI=1 npx expo export --platform web
```

Then hard-refresh the browser: `Ctrl+Shift+R`

The `npx serve dist -p 8081` process must already be running from `start-all.sh`.

## After Backend Code Changes

Nothing needed — uvicorn runs with `--reload` and watches `backend/`.  
Check logs: `tail -f /tmp/backend.log`

## Seed the Database

```bash
cd /home/penyahpepijat/claude/bengkil-Lah/booking/backend
/var/data/python/bin/python seed.py
```

Creates:
- 2 customers, 3 workshop owners
- 3 workshops with services and inventory
- Sample bookings and reviews

## Test Accounts

| Role | Email | Password |
|---|---|---|
| Customer | ali@example.com | password123 |
| Customer | siti@example.com | password123 |
| Workshop | hafiz@workshop.com | password123 |
| Workshop | ken@workshop.com | password123 |
| Workshop | puan@workshop.com | password123 |

## Log Files

| Log | Content |
|---|---|
| `/tmp/backend.log` | FastAPI/uvicorn output |
| `/tmp/expo-build.log` | Expo web build output |
| `/tmp/expo.log` | npx serve output |

```bash
tail -f /tmp/backend.log
tail -f /tmp/expo-build.log
tail -f /tmp/expo.log
```

## Environment

Backend `.env` (see `backend/.env.example`):
```
MONGODB_URL=mongodb://localhost:27017
DB_NAME=carbooking
SECRET_KEY=<jwt secret>
STRIPE_SECRET_KEY=<stripe key>
SMTP_HOST=...   # for OTP emails
```

## Known Issues

### passlib + Python 3.13
`passlib[bcrypt]` is incompatible with Python 3.13. `core/security.py` calls `bcrypt.hashpw()` directly. Never use `pwd_context.hash()` — it will 500 on registration.

### Stripe on web
`@stripe/stripe-react-native` is mocked for web. Payment UI renders but card capture is non-functional. Backend `/payments/` endpoints work fine — payment can be confirmed manually via API.

### Maps on web
`react-native-maps` is mocked. Map views render as blank containers. HomeScreen defaults to list mode on web.

## Related Notes
- [[Architecture]] — full tech stack
- [[Backend]] — file structure, router details
- [[Frontend]] — rebuild steps, web gotchas
- [[Features]] — what works and what's stubbed
