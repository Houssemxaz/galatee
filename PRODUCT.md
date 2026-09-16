# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Guests looking for a refined evening around handmade pasta, from discovery through reservation.

## Product Purpose
Turn the first visit to the site into a clear, atmospheric invitation to dine at Galatee, then guide a Guest to a valid Reservation without friction.

## Positioning
Galatee is a contemporary pasta restaurant where handmade craft, quiet service, and a precise evening atmosphere meet.

## Operating Context
The public site is browsed on desktop and mobile before a planned evening out. A Guest needs to understand the restaurant's point of view, see the menu language, choose a Date, Time Slot, and Party size, and provide contact details for confirmation.

## Capabilities and Constraints
- The frontend owns presentation, content hierarchy, responsive behavior, accessibility, and reservation form states.
- Availability is read from `GET /api/availability?date=YYYY-MM-DD&partySize=N`.
- Reservations are created with `POST /api/reservations`.
- The frontend must not invent persistence, confirmation status, capacity rules, or backend data.
- Shared domain terms are defined in `CONTEXT.md` and must be preserved.

## Brand Commitments
- The experience should feel like entering the restaurant, not reading a generic marketing page.
- The visual world is cold luxury: dirty white `#EFE9E9`, charcoal, smoke grey, chrome, and masterpiece red `#5A2123`.
- Photography should show real food craft, materiality, and hospitality.

## Evidence on Hand
- `CONTEXT.md`
- `tasks/frontend-agent-brief.md`
- `tasks/backend-agent-brief.md`
- `frontend/assets/galatee-hero.png`
- `frontend/assets/galatee-craft.png`
- `frontend/assets/galatee-room.png`

## Product Principles
1. Make the restaurant legible in the first viewport.
2. Keep the path to a Reservation visible and consistent.
3. Treat copy and imagery as hospitality, not decoration.
4. Show honest loading, empty, and error states.
5. Keep the interface calm enough to use on a phone before dinner.

## Accessibility & Inclusion
- Labels sit above all reservation inputs.
- Keyboard focus remains visible.
- Status updates use live regions.
- Motion is reduced when the Guest requests reduced motion.
- Reservation notes support allergies, occasions, seating preferences, and accessibility needs.
