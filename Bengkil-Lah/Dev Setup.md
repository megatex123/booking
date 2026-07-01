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
5. Serves the investor pitch deck (`pitch-serve/`) on port 8082 with `npx serve`

After startup:
- Backend API → `http://localhost:8000`
- API docs (Swagger) → `http://localhost:8000/docs`
- Web app → `http://localhost:8081`
- Pitch deck → `http://localhost:8082`

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
| `/tmp/expo.log` | npx serve (web app) output |
| `/tmp/pitch-serve.log` | npx serve (pitch deck) output |

```bash
tail -f /tmp/backend.log
tail -f /tmp/expo-build.log
tail -f /tmp/expo.log
tail -f /tmp/pitch-serve.log
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

## Public Deployment (Cloudflare Tunnel)

The app is publicly accessible via Cloudflare Tunnel (`~/.cloudflared/config.yml`, tunnel name `percubaan-tunnel`):

| URL | Service |
|---|---|
| `https://bengkil-lah.percubaan.com` | Web app (`localhost:8081`) |
| `https://bengkil-lah-api.percubaan.com` | FastAPI backend (`localhost:8000`) |
| `https://pitch.percubaan.com` | Investor pitch deck (`localhost:8082`) |

The tunnel must be running for these URLs to work. Start it with:
```bash
cloudflared tunnel run percubaan-tunnel
```

The mobile app (`src/services/api.ts` and `src/services/socket.ts`) auto-detects the environment:
- `localhost` → uses `http://localhost:8000`
- any other hostname → uses `https://bengkil-lah-api.percubaan.com`

### Static site hardening (web app + pitch deck)

Both `dist/` (web app) and `pitch-serve/` (pitch deck) are served with `npx serve` plus a `serve.json` config, **not** Python's `http.server` (no compression, no custom headers, and directory-listing risk if mis-invoked — this is what broke `pitch.percubaan.com` once before, exposing a filesystem listing when `--directory` was passed an empty value).

`serve.json` provides:
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`
- Caching: `immutable` for hashed static assets (`_expo/static/**`, `*.jpg`), `must-revalidate` for `index.html`
- gzip compression (automatic with `serve`)

Source locations:
- `mobile/public/serve.json` + `mobile/public/index.html` (SEO/OG meta tags, favicon) — copied into `dist/` on every `expo export --platform web`, since Expo treats `public/` as a template + static asset folder
- `pitch-serve/serve.json` — lives directly alongside `pitch-serve/index.html` (synced manually from `pitch.html` at the project root — copy both when editing the deck)

The pitch deck's logo was previously embedded 3× as base64 inside the HTML (~270KB of duplication). It's now a single external file (`pitch-serve/enigma-logo.jpg`, also reused as the favicon), cutting the page from 354KB to ~84KB raw / ~17KB gzipped.

## Related Notes
- [[Architecture]] — full tech stack
- [[Backend]] — file structure, router details
- [[Frontend]] — rebuild steps, web gotchas
- [[Features]] — what works and what's stubbed
