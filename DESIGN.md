# Galatee Visual Direction

## Design Read
Cold luxury editorial for a contemporary pasta house: dirty white, dark stone, brushed chrome, masterpiece red, and the small warmth of handmade food.

## Dials
- DESIGN_VARIANCE: 7
- MOTION_INTENSITY: 5
- VISUAL_DENSITY: 3

## Tokens
- Ink: `#151816`
- Charcoal: `#202522`
- Dirty white: `#EFE9E9`
- Smoke: `#a7aaa4`
- Masterpiece red: `#5A2123`
- Chrome: `#c9ccc6`
- Hairline: `rgba(242, 240, 235, 0.18)`

## Type
- Display: Cormorant Garamond, used for the restaurant name and editorial statements.
- Body: DM Sans, used for navigation, forms, metadata, and readable copy.
- Utility: DM Sans with tracked uppercase labels.

## Layout
- Floating nav under 80px, detached from the viewport edge.
- Hero is full-bleed and image-led with copy in the left negative space.
- Sections alternate between full-width atmosphere, off-grid editorial splits, and compact service information.
- Radius system stays compact at 8px or sharper. The reservation form uses a thin machined frame rather than a soft card.

## Signature
A circular plate-line motif appears as a quiet watermark around the primary reservation panel. It ties the action to the restaurant's craft without becoming an icon or a decorative scroll cue.

## Motion
Use reveal-on-enter with opacity and transform only. Keep transitions between 180ms and 700ms with a custom ease. The mobile menu uses a short mask reveal. Disable non-essential motion under `prefers-reduced-motion`.

## Image Set
- Hero: full-bleed service moment, dark negative space for copy.
- Craft: hands folding fresh pasta, section image with room for annotation.
- Room: dining room at evening service, atmosphere and location cue.

## Quality Bar
No generic three-card feature row, no decorative scroll cue, no placeholder imagery, no abrupt light/dark theme swap, no fake reservation success.
