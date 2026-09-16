# Galatee — SANTO Mobile Design Reference

> Grounding status: the public page was fetched with the bundled headless Playwright runtime at `https://santo.coffee/` (HTTP 200, title `SANTO Café – Hydra, Alger`). Its linked stylesheet was fetched from `https://santo.coffee/assets/index-glc4lJj1.css`, and a mobile screenshot was captured at `390 × 844` in `C:\Users\houssem\.codex\visualizations\2026\08\11\019ff292-be1d-7142-ac50-75e848e48418\santo-mobile-390.png`. Direct DevTools access was blocked by the shared browser profile lock and direct shell networking was refused, so the grounded observations below come from the successful Playwright HTML/CSS extraction and screenshot; no SANTO-specific asset is reused.

## 1. Visual Theme & Atmosphere

The reference presents a full-screen mobile entry with a light textured field, short navigational labels, and a vertical sequence of image-led cards. It suits a hospitality brand that wants discovery to feel tactile, paced, and intimate rather than like a conventional restaurant menu.

The useful grammar for Galatee is the feeling of moving through a small stack of printed food photographs: each card has a slight physical angle, a compact label with an arrow, and a clear next action. Galatee keeps its own cold-luxury palette, pasta photography, French copy, and reservation path.

### Key Characteristics

- Light textured surface as the first mobile atmosphere
- Vertical image-led card journey rather than a dense list
- Slightly tilted photographic prints with visible paper edge
- Short labels paired with directional arrows
- Menu entry that feels immersive but remains scroll-native
- Category controls that reveal a focused subset of dishes
- A persistent route back to the main page and reservation

## 2. Color Palette & Roles

The reference stylesheet exposes a light, near-white visual field but does not provide a stable, semantic palette suitable for Galatee reuse. This section therefore records only the verified Galatee adaptation tokens. They preserve the existing cold-luxury identity while allowing the reference grammar to change the composition, not the brand.

### Primary

| Hex | Role | Where seen |
| --- | --- | --- |
| `#151816` | Ink surface and primary dark action | `frontend/styles.css`, `:root --ink`, `.button-dark` |
| `#202522` | Charcoal section surface | `frontend/styles.css`, `:root --charcoal` |

### Accent

| Hex | Role | Where seen |
| --- | --- | --- |
| `#5A2123` | Masterpiece red for emphasis, active states, and editorial marks | `frontend/styles.css`, `:root --accent` |

### Surfaces

| Hex | Role | Where seen |
| --- | --- | --- |
| `#EFE9E9` | Dirty-white page surface and light text | `frontend/styles.css`, `:root --paper` |
| `#E7DDDD` | Deeper paper surface for tonal separation | `frontend/styles.css`, `:root --paper-deep` |
| `#A7AAA4` | Smoke secondary text and quiet metadata | `frontend/styles.css`, `:root --smoke` |
| `#C9CCC6` | Chrome text and light editorial accents | `frontend/styles.css`, `:root --chrome` |

### Borders

| Hex | Role | Where seen |
| --- | --- | --- |
| `#151816` at 15% alpha | Hairline separators on paper surfaces | `frontend/styles.css`, `:root --hairline-dark` |
| `#F2F0EB` at 18% alpha | Hairline separators on ink surfaces | `frontend/styles.css`, `:root --hairline-light` |

### Notes

Masterpiece red remains a restrained accent. The mobile card treatment should use dirty white, ink, and hairline rules as the physical paper language, with red reserved for category labels, active filters, and the primary route to reservation.

## 3. Typography Rules

The reference page computes `Space Grotesk, sans-serif` on `body`; its stylesheet also contains `Display`, `Inter Tight`, and `Ivy Mode` family declarations. Galatee does not copy those families: the adaptation keeps the existing linked Google Fonts, display `Cormorant Garamond` and body `DM Sans`, declared in `frontend/index.html` and assigned through `--display` / `--body` in `frontend/styles.css`.

### Hierarchy

| Role | Font | Size | Weight | Line height | Letter spacing |
| --- | --- | --- | --- | --- | --- |
| Display | Cormorant Garamond | `clamp(70px, 10.5vw, 153px)` desktop | 500 | 0.79 | -0.025em |
| H1 mobile | Cormorant Garamond | `clamp(62px, 19vw, 100px)` | 500 | 0.84 | inherited -0.025em |
| H2 | Cormorant Garamond | `clamp(58px, 8vw, 110px)` | 500 | 0.78 | -0.025em |
| H3 / dish title | Cormorant Garamond | `28px` | 500 | 0.98 | inherited |
| Body | DM Sans | `14px` base / `15px` editorial copy | 400 | 1.5 / 1.75 | 0 |
| Small | DM Sans | `9px–12px` | 500–600 | 1.3–1.65 | tracked uppercase labels |
| Mono | Not present | — | — | — | — |

### Principles

- Keep the serif for dish names and high-emotion editorial statements.
- Keep body copy in DM Sans and constrain it to short, calm measures.
- Use uppercase tracking only for navigation, categories, and metadata.
- Preserve the title as the dominant object; card metadata should never compete with it.
- On mobile, increase spacing around the display title before reducing its size.

## 4. Component Stylings

### Buttons

- **Primary:** `--ink` background, `--paper` text, no radius, `49px` minimum height, compact horizontal padding, circular arrow affordance. Hover shifts the background to `--accent`.
- **Secondary:** transparent or paper background with a hairline border, used for the menu category return and supporting actions.
- **Ghost:** text link with an underline, directional arrow, and a `44px` mobile hit area.
- **Destructive:** not present on the public page; do not introduce one for the menu.

### Cards

The reference markup contains photographic cards using image assets such as `/assets/coffee-shop-brutalist-DMy_3ElS.jpg`, `/assets/spanish-latte-B2IvBjtg.jpg`, and `/assets/aesthetic-clinic-BB4xzIrg.jpg`; Galatee does not reuse them. The adaptation uses a repeated vertical photo-print pattern on mobile: dirty-white card surface, thin ink border, compact paper padding, no rounded container, and a small physical tilt. The image, title, price, short summary, and long description remain one accessible disclosure. The tilt is visual only and must not alter the hit area.

### Inputs

The reservation form keeps labels above fields, thin hairline borders, square corners, `48px`-plus controls, a red focus ring, and `16px` mobile input text. The menu redesign must not change this form family.

### Navigation

Desktop uses the existing floating header with five destinations. Mobile collapses to a full-screen menu with five links. The new menu entry scrolls to `#menu`; category buttons stay native buttons with `aria-pressed`, and a visible “Retour” link returns to `#top`.

### Image Treatment

Menu photographs use local Galatee assets, `object-fit: cover`, a fixed aspect ratio, muted saturation, lazy loading, and descriptive alt text. The mobile card frame supplies the print-like edge; no SANTO asset or logo is reused.

### Distinctive

- **Menu print stack:** three dish photographs arranged as a vertical, lightly tilted sequence on mobile.
- **Category rail:** compact native controls that filter the stack without a second route.
- **Dish disclosure:** clicking or keyboard-activating the image/title summary reveals the long description.
- **Return route:** a small directional link closes the immersive feeling by returning to the page top.

## 5. Layout Principles

### Spacing Scale

The existing Galatee stylesheet uses a loose editorial ramp including `8, 10, 12, 16, 18, 20, 22, 24, 25, 30, 31, 35, 40, 42, 47, 48, 52, 55, 64, 70, 80, 85, 95, 110, 125, 145, 150, 155, 165px`. The mobile menu adaptation uses the smaller values for card metadata and the larger values only between major sections.

### Grid

Desktop content is capped at `1180px` through `.shell`, with a `calc(100% - 72px)` fluid width. Mobile narrows to `calc(100% - 36px)` at `560px` and below. The menu changes from a three-column grid to one vertical column on small screens; the card order remains the reading order.

### Whitespace

Whitespace is structural: it separates the photograph from the label and keeps the reservation path visible. The mobile version should feel like a deliberate sequence of moments, not a squeezed desktop grid. Avoid stacking extra explanatory copy inside the photo card.

### Radius Scale

The public identity uses sharp corners for cards, fields, buttons, and frames. Circles are reserved for the arrow affordance, plate mark, and wordmark; no large rounded card radius is introduced.

## 6. Depth & Elevation

### Levels

| Level | Use | Shadow |
| --- | --- | --- |
| 0 | Paper and ink surfaces | none |
| 1 | Tilted menu print separation | `0 8px 20px rgba(21, 24, 22, 0.10)` — Galatee adaptation. The reference CSS also contains layered polaroid shadow values: `0 4px 6px -1px hsl(var(--polaroid-shadow) / .3)`, `0 10px 20px -5px hsl(var(--polaroid-shadow) / .4)`, and `0 25px 50px -12px hsl(var(--polaroid-shadow) / .5)`. |
| 2 | Open disclosure emphasis | hairline border and accent state, no additional shadow |
| 3 | Mobile navigation overlay | `backdrop-filter: blur(16px)` with dark translucent surface |

### Philosophy

Depth comes primarily from paper edges, hairlines, image contrast, and slight rotation. Shadows are subordinate and only support the physical-print illusion; they must disappear or soften under reduced-motion and reduced-transparency preferences.

## 7. Interaction & Motion

### Hover States

Desktop buttons shift upward by `2px`, the arrow nudges diagonally, and the menu image increases saturation while lifting by `3px`. Nav links increase opacity and can take the chrome color. On touch devices, these hover states are not required for comprehension.

### Focus States

Inputs use the masterpiece-red border with a `3px` translucent ring. Menu summaries use a `2px` red outline with a `6px` offset. Native category buttons and the return link must retain a visible focus indicator.

### Transitions

Existing transitions use targeted properties between `180ms` and `360ms` with `cubic-bezier(0.23, 1, 0.32, 1)` for movement and `ease` for color. Reveal-on-enter uses opacity and transform over `700ms`. The menu stack can use a small opacity/translate entrance, but content order and disclosure state must work with JavaScript disabled and under `prefers-reduced-motion: reduce`.

## 8. Responsive Behavior

### Breakpoints

The source stylesheet uses max-width queries rather than min-width queries:

| Name | Query | Primary changes |
| --- | --- | --- |
| Compact | `max-width: 900px` | Desktop nav and header CTA collapse; mobile menu toggle appears; grids become single-column; menu becomes two columns |
| Small | `max-width: 560px` | Shell becomes `calc(100% - 36px)`; menu becomes one column; form rows stack; hero art direction changes; touch spacing increases |
| Landscape compact | `orientation: landscape` and `max-height: 600px` | Hero uses `100svh`, compact type and spacing, decorative bottom note is hidden |

### Touch Targets

Buttons, links, hamburger, contact links, and footer links target at least `44px` in height on mobile. Reservation controls remain at least `48px` tall, with `16px` text on narrow screens.

### Collapsing Strategy

The mobile menu is an overlay controlled by `aria-expanded` and `aria-hidden`, with hidden visibility when closed so its links do not remain focusable. The menu category rail stays horizontally readable but should wrap or scroll only if the labels cannot fit; the card content itself remains a single vertical flow.

### Image Behavior

The existing hero keeps its desktop `center / cover` art direction. At `max-width: 560px`, it uses `68% center` to reveal the chef's hands and the dish while preserving a dark text area. Menu images keep their explicit aspect ratio and local source assets, with `loading="lazy"` and `decoding="async"`.

## 9. Agent Prompt Guide

### Quick Color Reference

```text
#151816  // ink / dark action
#202522  // charcoal section
#5A2123  // masterpiece red accent
#EFE9E9  // dirty-white paper
#E7DDDD  // deeper paper
#A7AAA4  // smoke metadata
#C9CCC6  // chrome light accent
```

### Example Prompts

1. “Build a mobile-first Galatee menu in vanilla HTML/CSS/JS using `#EFE9E9`, `#151816`, and `#5A2123`; present local pasta photos as vertically stacked, slightly tilted paper prints with accessible native disclosures.”
2. “Keep Galatee’s `Cormorant Garamond` display and `DM Sans` body pairing, use 44px touch targets, and make the menu category buttons filter the card stack without changing the reservation payload.”
3. “Add a calm 180–300ms image lift and opacity reveal to the Galatee menu, keep all content available with reduced motion, and preserve the desktop three-column composition.”

### Iteration Guide

- Keep the SANTO-inspired grammar at the level of composition and pacing; never copy its text, logo, photographs, or palette.
- Change one motion variable at a time and verify the static state with JavaScript disabled.
- Preserve one clear reservation route above and below the menu stack.
- If a card feels crowded, reduce metadata before reducing the dish title below `28px`.
- Test `320px`, `375px`, `390px`, `430px`, and compact landscape after every layout change.
- Treat the existing CSS variables as the source of truth for Galatee colors.

### Sources & Limits

- Reference URL: [https://santo.coffee/](https://santo.coffee/), title verified as “SANTO Café – Hydra, Alger” through the web index.
- Public index result: the page exposes the labels “SANTO Café”, “Instagram”, “Le Menu”, and “Sculpt Wellness”.
- Reference observations: supplied in the project brief and checked against the captured mobile page: full-screen light field, angled photo-card composition, short arrow labels, vertical card journey, immersive menu categories, and return navigation.
- Grounded extraction: bundled Playwright fetched the HTML (29,286 characters), the linked stylesheet (74,680 characters), computed `body` as `Space Grotesk, sans-serif` with `rgb(26, 26, 26)` text, and found utility classes including `w-8 h-8` and `rounded-full` on the fixed information control. The stylesheet contains `@media (min-width: 768px)`, `0.25rem` radius utilities, and the layered shadow values documented above.
- Capture limit: Chrome DevTools could not attach because the shared profile was locked, and direct shell networking was refused; headless Playwright was used successfully for the grounded HTML/CSS extraction and `390 × 844` screenshot. SANTO text, logo, and photography are not copied into Galatee.
