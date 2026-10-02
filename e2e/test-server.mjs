import { DatabaseSync } from "node:sqlite";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const port = Number(process.env.E2E_PORT || 3199);
const adminToken = "e2e-admin-token";
const tempRoot = mkdtempSync(join(tmpdir(), "galatee-e2e-"));
const dbPath = join(tempRoot, "galatee.sqlite");
const uploadRoot = join(tempRoot, "uploads", "menu");
mkdirSync(uploadRoot, { recursive: true });

process.env.NODE_ENV = "test";
process.env.PORT = String(port);
process.env.GALATEE_DB_PATH = dbPath;
process.env.GALATEE_UPLOAD_DIR = uploadRoot;
process.env.GALATEE_ADMIN_TOKEN = adminToken;
process.env.GALATEE_ALLOWED_ORIGIN = `http://127.0.0.1:${port}`;
// Toute la suite tourne depuis la meme IP en moins d une minute : les limites
// de prod (8 commandes/min, 20 connexions/15 min) bloqueraient les derniers
// tests en 429. Relevees ici uniquement ; le rate limiting reste teste par
// backend/rateLimit.test.js et serverHardening.test.js.
process.env.RL_ORDER_MAX ||= "1000";
process.env.RL_AUTH_MAX ||= "1000";

const { createApp } = await import(new URL("../backend/server.js", import.meta.url));
const { MenuSystem } = await import(new URL("../backend/menuSystem.js", import.meta.url));
const { OrderSystem } = await import(new URL("../backend/orderSystem.js", import.meta.url));
const { AnalyticsSystem } = await import(new URL("../backend/analyticsSystem.js", import.meta.url));
const { CustomerAuthSystem } = await import(new URL("../backend/customerAuthSystem.js", import.meta.url));
const { LoyaltySystem } = await import(new URL("../backend/loyaltySystem.js", import.meta.url));
const { ClubSystem } = await import(new URL("../backend/clubSystem.js", import.meta.url));
const { DriverSystem } = await import(new URL("../backend/driverSystem.js", import.meta.url));

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
const menu = new MenuSystem({ db, uploadRoot });
const loyalty = new LoyaltySystem({ db });
const orders = new OrderSystem({ db, menu, loyalty });
const analytics = new AnalyticsSystem({ db });
const customerAuth = new CustomerAuthSystem({ db, sendEmail: async () => {} });
const club = new ClubSystem({ db });
const drivers = new DriverSystem({ db });

drivers.create({
  firstName: "E2E",
  lastName: "Livreur",
  phone: "+213555000001",
  pin: "1234",
});

const server = createApp({
  database: db,
  menu,
  orders,
  loyalty,
  analytics,
  customerAuth,
  club,
  drivers,
  requiredAdminToken: adminToken,
  corsAllowedOrigin: `http://127.0.0.1:${port}`,
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(tempRoot, { recursive: true, force: true });
}

process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`E2E server ready on http://127.0.0.1:${port}\n`);
});
