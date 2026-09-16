# Galatee Backend API

Galatee exposes the public reservation API used by the restaurant website and a small internal admin API for the back-office.

Persistence is SQLite through Node 24 `node:sqlite`, with no npm database dependency. The local database file is `backend/data/galatee.sqlite`. If `backend/data/reservations.json` exists and SQLite is empty, legacy JSON reservations and blocked time slots are migrated once at startup. The current JSON file is empty and only kept as a legacy migration source.

Core tables:

- `services`: recurring active services and capacities for `normal` and `vip`.
- `availability_settings`: one persistent global schedule used by all open weekdays.
- `availability_events`: date or date-range overrides that take priority over the global schedule.
- `reservations`: guest details, table type, party size and status.
- `blocked_time_slots`: manual blocks and automatic reservation-confirmation blocks.
- `menu_items` and `menu_item_revisions`: draft/published menu content and revision history.
- `daily_revenues`: legacy manually entered daily revenue totals kept for compatibility with older installations; they are no longer exposed in the current back-office.
- `analytics_events`: anonymous site and reservation events (`menu_viewed`, `reservation_cta_clicked`, `reservation_started`, `reservation_submitted`).

## Menu API

### `GET /api/menu`

Returns only published menu items, ordered by `sortOrder`. Optional query parameter: `category`.

### `GET /api/admin/menu`

Requires admin authorization. Returns the current draft and published revision for each non-archived item. Add `includeArchived=true` to include archived items.

### `POST /api/admin/menu`

Creates a draft menu item. JSON fields: `title`, `shortDescription`, `longDescription`, `price` or `priceCents`, `category`, `sortOrder`, `imageUrl` and `imageAlt`.

### `PATCH /api/admin/menu/:id`

Creates a new draft revision while keeping the last published revision unchanged.

### `POST /api/admin/menu/:id/publish`

Publishes the current draft revision atomically for future public reads.

### `DELETE /api/admin/menu/:id`

Archives the item without deleting its revisions.

### `POST /api/admin/menu/:id/image`

Accepts `multipart/form-data` with an `image` file. JPEG, PNG and WebP are accepted up to 5 MB. The server validates file signatures and generates the stored filename.

### `DELETE /api/admin/menu/:id/image`

Removes the image from a new draft revision.

## Site statistics API

### `GET /api/admin/site-stats?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month|year`

Requires admin authorization. Returns only operational site statistics: menu views, reservation status counts, the reservation funnel and the eight busiest non-cancelled time slots. No revenue data is included.

### `POST /api/analytics/events`

Public, non-personal endpoint for anonymous site and reservation events. Allowed events are `menu_viewed`, `reservation_cta_clicked`, `reservation_started` and `reservation_submitted`. An optional anonymous `sessionId` may be supplied; IP addresses are not stored.

## Legacy revenue compatibility API

### `PUT /api/admin/revenue`

Requires admin authorization. Upserts one daily total using `{ "date": "YYYY-MM-DD", "amount": "12500", "note": "optional" }`. Amounts are stored as integer cents and returned as `amountCents` plus a formatted `amount`; the demo currency is `DZD`.

### `GET /api/admin/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month|year`

Returns revenue series, period totals, reservation status counts and reservation-funnel event counts. `entries=true` returns editable daily revenue entries instead.

### `DELETE /api/admin/revenue/:date`

Deletes one daily revenue entry.

### `GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month|year`

Legacy aggregate payload retained for older clients. The current React back-office uses `/api/admin/site-stats` instead.

## Public API

### `GET /api/availability?date=YYYY-MM-DD&partySize=N&tableType=normal|vip`

Returns available time slots for a party and table type. `tableType` is optional and defaults to `normal` for compatibility. Blocked time slots and full time slots are omitted. Capacity only counts `confirmed` reservations; `requested` reservations remain admin review requests and do not reduce public availability.

Response:

```json
{
  "date": "2026-09-02",
  "partySize": 2,
  "tableType": "vip",
  "service": {
    "id": "dinner-wednesday",
    "name": "Dinner",
    "normalCapacityCovers": 18,
    "vipCapacityCovers": 4,
    "capacityCovers": 4
  },
  "timeSlots": [
    {
      "time": "19:00",
      "remainingCovers": 4,
      "available": true
    }
  ]
}
```

### `POST /api/reservations`

Creates a reservation request with status `requested`. The dashboard confirms it later with `PATCH /api/admin/reservations/:id/status`. `email` is optional; all other fields below are required except `specialRequest`.

Request:

```json
{
  "firstName": "Lina",
  "lastName": "Martin",
  "phone": "+33142380125",
  "email": "lina@example.com",
  "date": "2026-09-02",
  "time": "19:00",
  "partySize": 2,
  "tableType": "normal",
  "specialRequest": "Allergie noisette"
}
```

Response `201`:

```json
{
  "reservation": {
    "id": "uuid",
    "firstName": "Lina",
    "lastName": "Martin",
    "guestName": "Lina Martin",
    "phone": "+33142380125",
    "guestPhone": "+33142380125",
    "email": "lina@example.com",
    "guestEmail": "lina@example.com",
    "date": "2026-09-02",
    "time": "19:00",
    "partySize": 2,
    "tableType": "normal",
    "status": "requested",
    "specialRequest": "Allergie noisette",
    "createdAt": "2026-08-29T10:00:00.000Z",
    "updatedAt": "2026-08-29T10:00:00.000Z"
  }
}
```

## Admin API

If `GALATEE_ADMIN_TOKEN` is set, admin requests must send:

```http
Authorization: Bearer <token>
```

Without `GALATEE_ADMIN_TOKEN`, admin endpoints are open for local development.

### `GET /api/admin/reservations`

Optional query params:

- `date=YYYY-MM-DD`
- `status=requested|confirmed|cancelled|completed`

Response `200`:

```json
{
  "reservations": [
    {
      "id": "uuid",
      "firstName": "Lina",
      "lastName": "Martin",
      "guestName": "Lina Martin",
      "phone": "+33142380125",
      "guestPhone": "+33142380125",
      "email": "lina@example.com",
      "guestEmail": "lina@example.com",
      "date": "2026-09-02",
      "time": "19:00",
      "partySize": 2,
      "tableType": "normal",
      "status": "confirmed",
      "specialRequest": "Allergie noisette",
      "createdAt": "2026-08-29T10:00:00.000Z",
      "updatedAt": "2026-08-29T10:00:00.000Z"
    }
  ]
}
```

### `PATCH /api/admin/reservations/:id/status`

Request:

```json
{
  "status": "cancelled"
}
```

Response `200` returns the full reservation object in the same shape as `GET /api/admin/reservations`.

When a reservation moves from `requested` to `confirmed`, the API checks capacity again and consumes one table of the requested type in the same SQLite transaction. The automatic durable block for that `date`, `time` and `tableType` is created only when all configured tables of that type are occupied. Repeating `confirmed` on an already confirmed reservation is idempotent.

When a confirmed reservation is changed to `cancelled`, only its automatic block is removed. Manual blocks are never removed by reservation status changes.

If a manual block already covers the reservation's date/time/table type at confirmation time, the response is `409 TIME_SLOT_ALREADY_BLOCKED`.

### `GET /api/admin/availability-settings`

Returns the single global schedule: active weekdays, opening hours, slot interval and the number/capacity of normal and VIP tables.

### `PUT /api/admin/availability-settings`

Replaces the global schedule. `activeDays` is an array of weekday numbers (`0` Sunday through `6` Saturday). Table capacity is calculated as `tableCount * tableCapacity`. The update is rejected with `409 AVAILABILITY_CHANGE_CONFLICT` if it would invalidate a future confirmed reservation.

### `GET /api/admin/availability-settings/history`

Returns previous global schedule snapshots for operational traceability.

### `GET /api/admin/availability-events`

Lists special periods. An active event covering a date takes priority over the global schedule.

### `POST /api/admin/availability-events`

Creates a special period with `name`, `dateFrom`, `dateTo`, `startTime`, `endTime`, `slotIntervalMinutes`, `normalTableCount`, `normalTableCapacity`, `vipTableCount`, `vipTableCapacity` and optional `active`.

### `PATCH /api/admin/availability-events/:id` / `DELETE /api/admin/availability-events/:id`

Updates or removes a special period. Existing reservations are preserved; only future availability calculation changes.

Active periods cannot overlap. A change that would invalidate a confirmed reservation is rejected with `409 AVAILABILITY_CHANGE_CONFLICT`.

### `GET /api/admin/availability?date=YYYY-MM-DD&partySize=N&tableType=all|normal|vip&time=HH:mm`

Returns detailed dashboard availability. `date` and `partySize` are required. `tableType` is optional and defaults to `all`. `time` is optional; when provided, it must be an active service slot.

Response `200`:

```json
{
  "date": "2026-09-02",
  "partySize": 2,
  "tableType": "all",
  "time": "19:00",
  "service": {
    "id": "dinner-wednesday",
    "name": "Dinner",
    "normalCapacityCovers": 18,
    "vipCapacityCovers": 4
  },
  "timeSlots": [
    {
      "time": "19:00",
      "types": {
        "normal": {
          "capacityCovers": 18,
          "confirmedCovers": 2,
          "remainingCovers": 16,
          "available": true,
          "blocked": false
        },
        "vip": {
          "capacityCovers": 4,
          "confirmedCovers": 0,
          "remainingCovers": 4,
          "available": false,
          "blocked": true
        }
      }
    }
  ]
}
```

For `tableType=normal` or `tableType=vip`, each slot's `types` object contains only the requested type. `confirmedCovers` counts only reservations with status `confirmed`; `requested` reservations do not consume capacity.

### `GET /api/admin/services`

Returns the recurring service configuration used to generate availability. Each service exposes its active state, opening hours, slot interval, number of Normal/VIP tables, places per table and calculated total capacity.

### `PATCH /api/admin/services/:id`

Updates one recurring service. The body may contain `name`, `startTime`, `endTime`, `slotIntervalMinutes`, `normalTableCount`, `normalTableCapacity`, `vipTableCount`, `vipTableCapacity` and `active`. Total capacities are recalculated from the number of tables and places per table, then used by public availability immediately. Stored values are preserved across server restarts.

### `GET /api/admin/blocked-time-slots`

Optional query param:

- `date=YYYY-MM-DD`

Response `200`:

```json
{
  "blockedTimeSlots": [
    {
      "id": "uuid",
      "date": "2026-09-02",
      "time": "19:30",
      "tableType": "vip",
      "reason": "Private event",
      "reservationId": null,
      "createdBy": "manual",
      "createdAt": "2026-08-29T10:00:00.000Z"
    }
  ]
}
```

### `POST /api/admin/blocked-time-slots`

`tableType` is optional. If omitted, the time slot is blocked for both normal and VIP availability.

Request:

```json
{
  "date": "2026-09-02",
  "time": "19:30",
  "tableType": "vip",
  "reason": "Private event"
}
```

Response `201`:

```json
{
  "blockedTimeSlot": {
    "id": "uuid",
    "date": "2026-09-02",
    "time": "19:30",
    "tableType": "vip",
    "reason": "Private event",
    "reservationId": null,
    "createdBy": "manual",
    "createdAt": "2026-08-29T10:00:00.000Z"
  }
}
```

### `DELETE /api/admin/blocked-time-slots/:id`

Response `200`:

```json
{
  "removed": true
}
```

## Customer Accounts

Customer accounts are optional. The public site can request a six-digit email code, verify it, and receive an HttpOnly session cookie. Cross-origin frontend requests must use `credentials: "include"`.

### `POST /api/auth/request-code`

Signup requires `mode`, `email`, `firstName`, `lastName` and `phone`. Login only requires `mode: "login"` and `email`. The response never contains the code.

### `POST /api/auth/verify-code`

Request body: `{ "email": "client@example.com", "code": "123456" }`. A successful response returns `{ "account": { ... } }` and sets the session cookie.

### `GET /api/auth/me`

Returns `{ "account": null }` when the visitor is not signed in.

### `POST /api/auth/logout`

Invalidates the current customer session.

### `GET /api/account/reservations`

Returns the authenticated customer's reservations. Reservations made without a session remain public/guest reservations.

Email delivery uses Brevo when `BREVO_API_KEY` and `MAIL_FROM_EMAIL` are configured. Set `MAIL_FROM_NAME` optionally and use an exact `GALATEE_ALLOWED_ORIGIN` value for the deployed frontend; the default `*` is intended for local development and does not enable credentialed CORS. Brevo's free plan is limited to 300 emails per day.

Password accounts are available through `POST /api/auth/signup` with `firstName`, `lastName`, `phone`, `email`, `password` and `residenceCommune`, and `POST /api/auth/login` with `email` and `password`. Passwords are stored as salted `scrypt` hashes. The email-code endpoints remain available for existing installations during migration.

## Error Shape

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Important codes include:

- `400 AUTH_CODE_INVALID`
- `400 AUTH_EMAIL_INVALID`
- `400 AUTH_MODE_INVALID`
- `400 AUTH_PROFILE_INVALID`
- `400 AUTH_PROFILE_REQUIRED`
- `400 AUTH_PHONE_INVALID`
- `401 AUTH_UNAUTHORIZED`
- `409 AUTH_ACCOUNT_EXISTS`
- `429 AUTH_CODE_LOCKED`
- `429 AUTH_CODE_TOO_SOON` with `retryAfterSeconds`
- `503 AUTH_EMAIL_NOT_CONFIGURED`
- `503 AUTH_EMAIL_SEND_FAILED`
- `400 DATE_INVALID`
- `400 DATE_IN_PAST`
- `400 GUEST_FIRST_NAME_REQUIRED`
- `400 GUEST_LAST_NAME_REQUIRED`
- `400 GUEST_PHONE_INVALID`
- `400 GUEST_EMAIL_INVALID`
- `400 PARTY_SIZE_INVALID`
- `400 PARTY_SIZE_TOO_LARGE` with `maxPartySize`
- `400 REQUEST_BODY_INVALID`
- `400 RESERVATION_STATUS_INVALID`
- `400 TABLE_TYPE_INVALID`
- `400 TIME_INVALID`
- `401 ADMIN_UNAUTHORIZED`
- `404 BLOCKED_TIME_SLOT_NOT_FOUND`
- `404 NOT_FOUND`
- `404 RESERVATION_NOT_FOUND`
- `409 TIME_SLOT_ALREADY_BLOCKED`
- `409 TIME_SLOT_UNAVAILABLE`
- `413 REQUEST_BODY_TOO_LARGE`
- `422 SERVICE_CLOSED`
- `422 TIME_SLOT_INVALID`
- `500 INTERNAL_ERROR`

## Orders and loyalty

### `POST /api/orders`

Creates a pending delivery or pickup order. Items must reference published, available catalogue entries of type `dish`, `menu` or `offer`. An authenticated customer may send `loyaltyRewardId`; the server calculates the discount, stores the final total and consumes the reward atomically.

### `GET /api/pasta-lover-club`

Returns the public Pasta Lover Club presentation and active events.

### `GET /api/admin/pasta-lover-club`

Returns the editable club presentation and all events. `PUT /api/admin/pasta-lover-club` updates the presentation; `POST /api/admin/pasta-lover-club/events`, `PATCH /api/admin/pasta-lover-club/events/:id` and `DELETE /api/admin/pasta-lover-club/events/:id` manage the programming.

The former reservation and availability endpoints remain readable for migration compatibility but are no longer linked by the order-only public site or back-office navigation.
