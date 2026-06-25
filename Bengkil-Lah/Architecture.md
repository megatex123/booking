# Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Browser / Web App                    │
│              Expo 51 → static web build                  │
│                   http://localhost:8081                   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (Axios)  +  WebSocket (Socket.IO)
┌────────────────────────▼────────────────────────────────┐
│                    FastAPI Backend                        │
│              socketio.ASGIApp wraps FastAPI               │
│                   http://localhost:8000                   │
│                                                          │
│  Routers: auth, users, workshops, bookings,              │
│           chat, reviews, payments, uploads,              │
│           notifications                                  │
└────────────────────────┬────────────────────────────────┘
                         │ Motor (async)
┌────────────────────────▼────────────────────────────────┐
│                      MongoDB                             │
│            localhost:27017 / db: carbooking              │
│  Collections: users, workshops, bookings,                │
│               reviews, messages, notifications           │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend language | Python 3.13 | |
| Web framework | FastAPI | async, ASGI |
| DB driver | Motor 3 | async MongoDB |
| Realtime | python-socketio | ASGI-wrapped |
| Auth | python-jose (JWT) | HS256 tokens |
| Password hashing | `bcrypt` directly | passlib incompatible with Py3.13 |
| Payments | Stripe SDK | payment intent flow |
| File storage | Local `/uploads/` | served as FastAPI static files |
| Frontend | Expo 51 (React Native) | exported as web build |
| State management | Redux Toolkit | 4 slices |
| HTTP client | Axios | JWT request interceptor |
| Navigation | React Navigation | bottom tabs + stack |
| Styling | Custom theme (`src/utils/theme.ts`) | |

## Entry Points

| File | Purpose |
|---|---|
| `backend/main.py` | FastAPI app + Socket.IO ASGI wrapper (`socket_app`) |
| `mobile/App.tsx` | Expo root, wraps `<AppNavigator>` in Redux `<Provider>` |
| `start-all.sh` | Orchestrates MongoDB → backend → expo build → serve |

## Related Notes
- [[Backend]] — routers, models, middleware
- [[Frontend]] — screens, navigation, state
- [[Realtime]] — Socket.IO event map
- [[Dev Setup]] — how to start everything
