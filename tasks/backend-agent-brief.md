# Backend Agent Brief

## Mission
Build the backend reservation system for a high-end pasta restaurant website.

## Scope
- Create reservation data model.
- Provide API endpoints for availability lookup and reservation creation.
- Validate guest input.
- Prevent overbooking by service / time slot capacity.
- Return frontend-friendly errors.
- Keep persistence durable if the project stack supports it.

## Domain Terms
Use the canonical terms in `CONTEXT.md`: Guest, Reservation, Party, Cover, Service, Time Slot, Capacity, Special Request.

## Suggested Data Model
- services: id, name, weekday, start_time, end_time, slot_interval_minutes, capacity_covers, active
- reservations: id, guest_name, guest_email, guest_phone, date, time, party_size, status, special_request, created_at, updated_at

## API Contract
- GET `/api/availability?date=YYYY-MM-DD&partySize=N`
  - Returns available time slots with remaining covers.
- POST `/api/reservations`
  - Accepts guest details, date, time, party size, and optional special request.
  - Returns confirmed reservation id and status.

## Validation Rules
- Party size must be a positive integer and within restaurant policy.
- Date and time must match an active service / time slot.
- Required guest fields: name, email, phone.
- Email and phone must be valid enough for confirmation contact.
- Do not allow confirmed reservations beyond remaining capacity.
- Special request is optional and length-limited.

## Persistence Notes
- For durable structured state, prefer platform-backed storage such as D1 / SQLite if using Sites.
- Keep database access behind a small helper.
- Use prepared statements.
- Create indexes only for actual query patterns, especially date, time, and status.

## Deliverable
Implement backend code, schema, and tests or verification steps. Do not modify visual design except when needed to wire the reservation form.
