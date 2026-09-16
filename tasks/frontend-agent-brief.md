# Frontend Agent Brief

## Mission
Build the frontend for a chic, high-end restaurant website specialized in pasta. The first screen must feel like the actual restaurant experience, not a marketing template.

## Design Read
Reading this as: premium restaurant website for guests planning a refined dining experience, with a luxury hospitality language, leaning toward cold luxury / editorial photography, refined typography, restrained motion.

## Dials
- DESIGN_VARIANCE: 7
- MOTION_INTENSITY: 5
- VISUAL_DENSITY: 3

## Visual Direction
- Avoid the default beige, brass, espresso luxury palette.
- Prefer cold luxury: off-white, charcoal, smoke grey, chrome accents, and one deep green or burgundy accent if needed.
- Use real or generated food / restaurant imagery. The hero needs a strong visual of pasta, plating, kitchen craft, or dining room atmosphere.
- Keep the page theme locked. No abrupt light/dark section flips.
- Use one radius system: compact 8px or sharper, unless the final stack already defines tokens.
- Use icons from one installed icon family only. Check package.json before importing.

## Required Sections
- Hero with restaurant name, short positioning, and reservation CTA.
- Menu preview focused on handmade pasta, seasonal tasting, wine pairing.
- Chef or craft section.
- Reservation entry point with clear date, time, party size flow.
- Location / hours / contact.
- Footer with essential links.

## UX Requirements
- Navigation fits on one desktop line and stays under 80px height.
- Reservation CTA label is consistent everywhere.
- Labels above inputs. No placeholder-as-label.
- Loading, empty, and error states for reservation UI.
- Mobile layouts collapse explicitly below 768px.
- Honor reduced motion.
- Avoid generic three equal feature cards and decorative scroll cues.

## Deliverable
Implement frontend components and styles only. Do not invent backend persistence behavior. Use mocked API contracts only if backend endpoints are not ready, and document the expected contract.
