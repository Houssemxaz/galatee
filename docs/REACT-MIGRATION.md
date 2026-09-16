# Galatee React Migration

## Architecture

The public experience now lives in `frontend-react/`, a Vite React application. It owns the public landing page, menu discovery, dish detail dialog and reservation form. The generated shadcn/ui primitives are local under `frontend-react/src/components/ui/`, with `lucide-react` providing the interface icons.

The existing `frontend/` directory is deliberately preserved for the operational dashboard. `frontend/admin.html`, `admin.css`, `admin.js` and their legacy assets continue to be served at `/admin.html` and are not coupled to the React bundle.

Production output is generated at `frontend-react/dist/`. `backend/server.js` serves that build for `/`, `/index.html`, built assets and extensionless public routes. It falls back to the React index only for public routes; `/api/*` is always handled by the backend first. Legacy admin files continue to resolve from `frontend/`.

## Commands

From the repository root:

```powershell
npm install --prefix frontend-react
npm run dev
npm run build
npm run preview
npm start
npm test
```

`npm run dev` starts Vite with `/api` proxied to `http://localhost:3000`. `npm run build` must run before checking the production route through Node. `npm start` serves the built public site and the legacy admin from the same origin.

The backend persistence uses Node's built-in `node:sqlite`, so the supported runtime is Node 24 or newer (also declared in the root `package.json` engines field).

## API Integration

The React reservation form preserves the existing contracts:

- `GET /api/availability?date=YYYY-MM-DD&partySize=N&tableType=normal|vip`
- `POST /api/reservations` with `firstName`, `lastName`, `phone`, optional `email`, `date`, `partySize`, `tableType`, `time` and optional `specialRequest`

The form keeps requested reservations honest: a successful submission displays “Demande reçue / En attente de confirmation” and never claims that a table is already confirmed. Availability errors disable the time selection instead of inventing demo slots.

The admin page continues to use the existing authenticated endpoints for reservations, availability and blocked time slots. No business logic or persistence code was changed for this frontend migration; the server change is limited to static build routing and API configuration injection.

## Design System

Galatee tokens remain the source of truth: masterpiece red `#5A2123`, dirty white `#EFE9E9`, ink `#151816`, charcoal `#202522`, Cormorant Garamond for display type and DM Sans for interface copy. shadcn defaults are overridden in `frontend-react/src/index.css`; the result is a local, customizable component layer rather than a preset theme.

The public page remains mobile-first, keeps the SANTO-inspired vertical photo-print menu grammar documented in `docs/design-references/santo-mobile-design.md`, and supports keyboard focus, reduced motion, touch-sized controls and native browser form semantics.

## Integration Notes

- Deploy or run `npm run build` before starting the production Node server.
- Keep `frontend-react/dist/` available on the host; it is the public static root after a successful build.
- Keep `frontend/` available because `/admin.html` remains the operational back-office entry point.
- A future restaurant-software connector can continue to sit behind the existing `/api` contracts without changing React components.
