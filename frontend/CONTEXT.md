# Frontend Public Surface

One job: present Galatee as a refined pasta restaurant and expose a truthful entry point into the Reservation flow.

## Inputs
- Working: `../CONTEXT.md`
- Working: `../tasks/frontend-agent-brief.md`
- Working: `../tasks/backend-agent-brief.md`
- Reference: `../PRODUCT.md`
- Reference: `../DESIGN.md`
- Assets: `assets/galatee-hero.png`, `assets/galatee-craft.png`, `assets/galatee-room.png`

## Process
1. Keep the first viewport image-led and reservation-oriented.
2. Use canonical restaurant vocabulary from the root context.
3. Render loading, empty, and error states for availability.
4. Call only the documented availability and reservation endpoints.
5. Keep all backend behavior behind the integration points in `app.js`.

## Outputs
- `index.html` -> public restaurant surface
- `styles.css` -> tokens, layout, responsive states, motion
- `app.js` -> navigation, reveal behavior, availability adapter, reservation form states
- `admin.html` -> internal operations surface
- `admin.css` -> dense admin layout and responsive states
- `admin.js` -> session token, admin API adapter, filters, status actions, blocked Time Slots

## Human check
Open `index.html` on desktop and mobile widths. Confirm the page reads as a restaurant within one viewport, the Reservation anchor is always discoverable, and an unavailable backend is communicated without pretending a Reservation was saved.

## Backend integration contract
- `GET /api/availability?date=YYYY-MM-DD&partySize=N` returns `{ "timeSlots": [{ "time": "19:30", "remainingCovers": 4 }] }`.
- `POST /api/reservations` accepts `firstName`, `lastName`, `phone`, optional `email`, `date`, `partySize`, `tableType` (`Normal` or `VIP`), `time`, and optional `specialRequest`.
- A successful response should return `{ "reservationId": "...", "status": "requested" | "confirmed" }`.
- Frontend does not persist a Reservation locally.
- The admin surface displays `firstName`, `lastName`, `phone`, `email`, `tableType`, and `specialRequest` when returned by the API.
- The static surface uses indicative Time Slots until `window.GALATEE_API_BASE` is configured by the application host, for example `"/api"`.

## Admin integration contract
- `admin.js` defaults to `window.GALATEE_API_BASE || "/api"` and sends `Authorization: Bearer <token>` when `sessionStorage["galatee.adminToken"]` is present.
- The admin UI reads and writes only the endpoints defined in `backend/API.md`.
- Token data is session-scoped in the browser and is never sent anywhere except the admin API calls.
