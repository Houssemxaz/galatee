// Boot d un serveur Galatee dedie aux tests E2E : base SQLite isolee dans un
// dossier temporaire, jeu de donnees seede a la volee (menu, livreur), token
// admin fixe. La vraie base backend/data/galatee.sqlite n'est jamais touchee.
//
// Utilise par playwright.config.js via webServer. Lance manuellement :
//   node e2e/test-server.mjs

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Env FIGE avant l import de server.js (les constantes du module sont lues
//     au chargement, pas a chaque requete) ────────────────────────────────
export const E2E_PORT = Number(process.env.E2E_PORT || 3199);
export const E2E_ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN || "e2e-admin-token-abcdef";
export const E2E_DRIVER_PHONE = "+213 555 000 001";
export const E2E_DRIVER_PIN = "1234";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const dbDir = join(tmpdir(), `galatee-e2e-${process.pid}`);
const dbPath = join(dbDir, "galatee-e2e.sqlite");
const uploadDir = join(dbDir, "uploads");
if (existsSync(dbDir)) rmSync(dbDir, { recursive: true, force: true });
mkdirSync(dbDir, { recursive: true });
mkdirSync(uploadDir, { recursive: true });

process.env.GALATEE_DB_PATH = dbPath;
process.env.GALATEE_UPLOAD_DIR = uploadDir;
process.env.GALATEE_ADMIN_TOKEN = E2E_ADMIN_TOKEN;
process.env.PORT = String(E2E_PORT);
// NODE_ENV reste "development" : le hardening (quand il sera merge) ne bloquera
// pas le boot. En mode E2E on n'exerce pas les protections prod-only.

const { createApp } = await import("../backend/server.js");
const { MenuSystem } = await import("../backend/menuSystem.js");
const { OrderSystem } = await import("../backend/orderSystem.js");
const { DriverSystem } = await import("../backend/driverSystem.js");
const { LoyaltySystem } = await import("../backend/loyaltySystem.js");
const { SqliteReservationStore, ReservationSystem } = await import("../backend/reservationSystem.js");
const { CustomerAuthSystem } = await import("../backend/customerAuthSystem.js");
const { AnalyticsSystem } = await import("../backend/analyticsSystem.js");
const { ClubSystem } = await import("../backend/clubSystem.js");

// ─── Store isolé (fichier temporaire) ───────────────────────────────────
const store = new SqliteReservationStore({ databasePath: dbPath });
const system = new ReservationSystem({ store });
const menu = new MenuSystem({ db: store.db, uploadRoot: uploadDir });
const loyalty = new LoyaltySystem({ db: store.db });
const orders = new OrderSystem({ db: store.db, menu, loyalty });
const analytics = new AnalyticsSystem({ db: store.db });
const customerAuth = new CustomerAuthSystem({ db: store.db, sendEmail: async () => {} });
const club = new ClubSystem({ db: store.db });
const drivers = new DriverSystem({ db: store.db });

// ─── Seed deterministe ─────────────────────────────────────────────────
// Un plat publie, dispo, prix 1500 DA (15,00).
const seededDish = menu.create({
  title: "Spaghetti Pomodoro E2E",
  price: "15",
  category: "fresca",
  description: "Plat de test E2E",
});
menu.publish(seededDish.id);

// Un livreur actif avec PIN connu.
const seededDriver = drivers.create({
  firstName: "TestDriver",
  lastName: "E2E",
  phone: E2E_DRIVER_PHONE,
  pin: E2E_DRIVER_PIN,
});

const seed = {
  dishId: seededDish.id,
  dishTitle: seededDish.title,
  driverId: seededDriver.id,
  driverPhone: E2E_DRIVER_PHONE,
  driverPin: E2E_DRIVER_PIN,
  adminToken: E2E_ADMIN_TOKEN,
};

// ─── Serveur HTTP ──────────────────────────────────────────────────────
const server = createApp({
  system,
  menu,
  orders,
  loyalty,
  analytics,
  customerAuth,
  club,
  drivers,
  requiredAdminToken: E2E_ADMIN_TOKEN,
  corsAllowedOrigin: `http://127.0.0.1:${E2E_PORT}`,
});

server.listen(E2E_PORT, () => {
  // Format lisible par playwright.config.js (webServer.url + regex match sur
  // stdout pour detecter que le serveur est pret).
  console.log(`E2E server ready on http://127.0.0.1:${E2E_PORT}`);
  console.log(`E2E seed: ${JSON.stringify(seed)}`);
});

function shutdown(signal) {
  console.log(`E2E server shutting down (${signal})`);
  server.close(() => {
    try { store.close(); } catch { /* ignore */ }
    try { rmSync(dbDir, { recursive: true, force: true }); } catch { /* ignore */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Aide au debug : dispo pour un require depuis les tests si besoin.
export { seed };
