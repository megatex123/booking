# Frontend

Expo 51 (React Native) exported as a static web build. Runs in browser at `http://localhost:8081`.

## File Map

```
mobile/
├── App.tsx                  Root — Redux Provider + AppNavigator
├── app.json                 Expo config
├── babel.config.js
├── metro.config.js          Web platform resolveRequest (mocks native packages)
├── dist/                    Built web output (served by npx serve)
└── src/
    ├── components/
    │   ├── common/          Button, Card, Input, Loading, StatusBadge,
    │   │                    ShakingBell, LocationMap, WorkshopsMap
    │   └── customer/        WorkshopCard
    ├── mocks/               Web stubs (see below)
    ├── navigation/          RootNavigator, CustomerNavigator, WorkshopNavigator
    ├── screens/
    │   ├── auth/
    │   ├── customer/
    │   ├── workshop/
    │   └── shared/
    ├── services/
    │   ├── api.ts           All Axios API calls
    │   ├── socket.ts        Socket.IO client (connect/disconnect/getSocket)
    │   └── storage.ts       AsyncStorage wrappers (token, user)
    ├── store/               Redux slices
    ├── types/index.ts       All shared TypeScript interfaces
    └── utils/
        ├── theme.ts         Colors, Typography, Spacing, BorderRadius, StatusColors
        ├── webAlert.ts      showAlert() / showConfirm() — web-safe Alert replacements
        └── helpers.ts       Date formatting, status label helpers
```

## Navigation Structure

### Auth Stack (unauthenticated)
```
Welcome → UserType → Login
                   → Register
          UserType → ForgotPassword → VerifyOTP → ResetPassword
```

### Customer Navigator (bottom tabs: Dashboard / Explore / Bookings / Profile)

```
Dashboard tab
  └── CustomerDashboard → Notifications, MyReviews

Explore tab
  └── Home → WorkshopDetail → Booking → BookingSuccess
                            → BookingDetail → Chat
                                           → Payment
                                           → Review

Bookings tab
  └── BookingHistory → BookingDetail → Chat, Payment, Review

Profile tab
  └── Profile → EditProfile, ChangePassword, MyVehicles → VehicleServiceHistory
              → MyReviews, Notifications, BookingDetail, HelpSupport, PrivacyPolicy
```

### Workshop Navigator (bottom tabs: Dashboard / Bookings / Profile)

```
Dashboard tab
  └── Dashboard → WorkshopBookingDetail → Chat
               → Services (ServiceManagement)
               → WorkshopProfile
               → WorkshopReviews
               → WorkshopManagement → ProductManagement, WorkshopLayout, MechanicManagement
               → AnalyticsDashboard
               → Notifications

Bookings tab
  └── WorkshopBookings → WorkshopBookingDetail → Chat

Profile tab
  └── Profile → EditProfile, ChangePassword
             → Services, WorkshopProfile, WorkshopReviews
             → WorkshopManagement → ProductManagement, WorkshopLayout, MechanicManagement
             → CustomerCRM
             → Notifications, WorkshopBookingDetail, HelpSupport, PrivacyPolicy
```

## State Management (Redux Toolkit)

| Slice | State Held |
|---|---|
| `authSlice` | `user`, `token`, loading/error — persisted via AsyncStorage |
| `bookingSlice` | booking list, selected booking, create/fetch thunks |
| `workshopSlice` | workshop list, selected workshop, services, products, stations |
| `notificationSlice` | notifications array, unread count |

`serializableCheck: false` — Redux doesn't complain about non-serializable values (e.g. dates from API).

## API Service (`src/services/api.ts`)

Base URL hardcoded: `http://localhost:8000/api/v1`

API modules:
- `authAPI` — login, register, forgot/reset/change password
- `userAPI` — me, update, vehicles, online status
- `workshopAPI` — nearby, by ID, my profile, services, products, stations
- `bookingAPI` — create, my bookings, by ID, status update, cancel, reschedule, assign station
- `chatAPI` — get messages, send message
- `reviewAPI` — create, my reviews, workshop reviews, booking review
- `notificationAPI` — list, unread count, mark read, mark all read
- `paymentAPI` — create intent, confirm payment
- `uploadAPI` — multipart file upload (handles web blob URLs and native RN paths)

## Web Platform Gotchas

### Native package mocks (`metro.config.js` + `src/mocks/`)
| Package | Mock behaviour |
|---|---|
| `react-native-maps` | Returns a plain `<View>` (no map rendered) |
| `@stripe/stripe-react-native` | No-op stubs for all Stripe components |
| `expo-location` | Returns dummy coordinates |

### Alert on web
`Alert.alert()` is a no-op in React Native Web. Always use:
```ts
import { showAlert, showConfirm } from '../utils/webAlert';
```

### Map mode default
`HomeScreen` defaults to list view on web:
```ts
const [mapMode, setMapMode] = useState(Platform.OS !== 'web');
```

### Filter chip ScrollView
Must have `maxHeight: 44` and chips need `alignSelf: 'flex-start'` to prevent height stretching on web.

## Socket.IO Client (`src/services/socket.ts`)

- Connects with JWT auth header after login
- `RootNavigator` attaches `new_notification` listener whenever `user` changes
- Chat screen joins `booking_{id}` room and listens for `new_message`
- Booking detail listens for `booking_status_updated`

## UI Design System

### Visual Design Language
Cards use a consistent style across the app:
- `borderRadius: 16` (was `BorderRadius.md`)
- `borderWidth: 1, borderColor: colors.border` — subtle outline
- Shadow: `shadowOpacity: 0.07–0.08, shadowRadius: 8–10, elevation: 2–3`

### WelcomeScreen (`src/screens/auth/WelcomeScreen.tsx`)
Two-zone split layout:
- **Hero (top, flex 1):** `colors.primary` background, 96px logo ring with `car-sport` icon, brand name (38px/800), tagline
- **Sheet (bottom):** `colors.background` with `borderTopLeftRadius/RightRadius: 32`, 3 feature rows (icon circle + label + description), Get Started button, Sign In link

### HomeScreen workshop cards
Each card has:
- **Avatar circle (50px):** colored by `getAvatarColor(name)` (palette of 8 colors hashed from first char), shows 2-letter initials
- No left accent strip — open/closed status shown as badge in top-right
- Fav heart icon stacked above open/closed badge on the right

### BookingHistoryScreen booking cards
- **Left accent strip: 5px** (was 4px) colored by `StatusColors[status]`
- Info row (date/time/plate) rendered as chip-style items with `colors.background` fill
- Workshop name: 16px/800 weight
- Price: 17px/800 weight

### DashboardScreen (vendor)
- Header greeting: 20px/800, workshop name 13px subtitle
- Stat cards and revenue card: `borderRadius: 16`, `borderWidth: 1`

## Related Notes
- [[Architecture]] — system diagram
- [[Realtime]] — Socket.IO event map
- [[Data Models]] — TypeScript types
- [[Features]] — what's complete vs stub
