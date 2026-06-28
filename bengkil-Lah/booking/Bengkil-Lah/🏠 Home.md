# Bengkil Lah — Project Map

> "Bengkil Lah" is Malay slang for **"go to the workshop lah"** — a two-sided marketplace connecting **customers** with **workshop vendors** for car servicing.

---

## Quick Links

| Area | Note |
|---|---|
| System overview | [[Architecture]] |
| Backend (FastAPI + MongoDB) | [[Backend]] |
| Mobile (Expo + React Native) | [[Frontend]] |
| Database schemas | [[Data Models]] |
| Booking lifecycle | [[Booking Flow]] |
| Real-time events | [[Realtime]] |
| All API endpoints | [[API Reference]] |
| Running the project | [[Dev Setup]] |
| Feature status | [[Features]] |
| Finance & payments | [[Finance]] |
| Planned future features | [[Future Features]] |

---

## At a Glance

```
booking/
├── backend/     FastAPI + Motor + Socket.IO
├── mobile/      Expo 51 (React Native → web build)
├── Bengkil-Lah/ This Obsidian vault
└── start-all.sh Starts MongoDB + backend + web server
```

- Backend → `http://localhost:8000` (docs at `/docs`)
- Web app → `http://localhost:8081`

## Two User Roles

```
Customer                Workshop Vendor
────────                ───────────────
Browse workshops        Manage profile & services
Book services           Confirm / reject bookings
Pay via Stripe          Mark in-progress / complete
Chat with workshop      Chat with customer
Leave reviews           View reviews
Reschedule bookings     Assign repair stations
```
