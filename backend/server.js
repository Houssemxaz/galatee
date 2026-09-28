import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AnalyticsError, AnalyticsSystem } from "./analyticsSystem.js";
import {
  buildSessionCookie,
  CustomerAuthError,
  CustomerAuthSystem,
} from "./customerAuthSystem.js";
import { MenuError, MenuSystem } from "./menuSystem.js";
import { OrderError, OrderSystem } from "./orderSystem.js";
import { LoyaltyError, LoyaltySystem } from "./loyaltySystem.js";
import { ClubError, ClubSystem } from "./clubSystem.js";
import { DriverError, DriverSystem, buildDriverSessionCookie } from "./driverSystem.js";
import {
  ReservationError,
  ReservationSystem,
  SqliteReservationStore,
} from "./reservationSystem.js";
import {
  applyCorsHeaders as applyCorsHeadersImpl,
  applySecurityHeaders,
  ensureRequestId,
  IS_PRODUCTION,
  isSecureRequest,
  logger,
  resolveClientIp,
  resolveCorsOrigin,
  safeTokenCompare,
} from "./security.js";
import { applyRateLimit, limiterFromEnv } from "./rateLimit.js";
import { InMemoryIdempotencyStore, readIdempotencyKey } from "./idempotency.js";

const rootDir = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const frontendDir = join(rootDir, "frontend");
const reactDistDir = join(rootDir, "frontend-react", "dist");
const databasePath = join(rootDir, "backend", "data", "galatee.sqlite");
const legacyJsonPath = join(rootDir, "backend", "data", "reservations.json");
const menuUploadDir = join(rootDir, "backend", "data", "uploads", "menu");
const port = Number(process.env.PORT || 3000);
const adminToken = process.env.GALATEE_ADMIN_TOKEN || "";
const allowedOrigin = process.env.GALATEE_ALLOWED_ORIGIN || "*";

// Limites configurables par variables d env RL_<NAME>_WINDOW_MS / RL_<NAME>_MAX.
// Les defauts protegent contre le bruteforce (auth, driver login), les floods
// (analytics, uploads) et les abus (admin, orders).
const defaultRateLimiters = {
  auth: limiterFromEnv("AUTH", { windowMs: 15 * 60 * 1000, max: 20 }),
  order: limiterFromEnv("ORDER", { windowMs: 60 * 1000, max: 8 }),
  analytics: limiterFromEnv("ANALYTICS", { windowMs: 60 * 1000, max: 60 }),
  upload: limiterFromEnv("UPLOAD", { windowMs: 60 * 1000, max: 10 }),
  admin: limiterFromEnv("ADMIN", { windowMs: 60 * 1000, max: 120 }),
};
const defaultIdempotencyStore = new InMemoryIdempotencyStore();

const reservationSystem = new ReservationSystem({
  store: new SqliteReservationStore({ databasePath, legacyJsonPath }),
});
const menuSystem = new MenuSystem({ db: reservationSystem.store.db, uploadRoot: menuUploadDir });
const loyaltySystem = new LoyaltySystem({ db: reservationSystem.store.db });
const orderSystem = new OrderSystem({ db: reservationSystem.store.db, menu: menuSystem, loyalty: loyaltySystem });
const analyticsSystem = new AnalyticsSystem({ db: reservationSystem.store.db });
const customerAuthSystem = new CustomerAuthSystem({ db: reservationSystem.store.db });
const clubSystem = new ClubSystem({ db: reservationSystem.store.db });
const driverSystem = new DriverSystem({ db: reservationSystem.store.db });

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
]);

export function createApp({
  system = reservationSystem,
  menu = menuSystem,
  orders = orderSystem,
  loyalty = loyaltySystem,
  analytics = analyticsSystem,
  customerAuth = customerAuthSystem,
  club = clubSystem,
  drivers = driverSystem,
  requiredAdminToken = adminToken,
  corsAllowedOrigin = allowedOrigin,
  rateLimiters = defaultRateLimiters,
  idempotencyStore = defaultIdempotencyStore,
} = {}) {
  return createServer(async (request, response) => {
    const requestId = ensureRequestId(request);
    response.setHeader("X-Request-Id", requestId);
    try {
      const url = new URL(request.url, "http://localhost");
      applyCorsHeadersImpl(response, corsAllowedOrigin);
      applySecurityHeaders(response, { isSecure: isSecureRequest(request) });

      if (request.method === "OPTIONS") {
        response.writeHead(204, { "Content-Length": "0" });
        response.end();
        return;
      }

      // Health checks — jamais rate-limited, jamais authentifies, jamais
      // journalisation verbeuse (evite le bruit des probes systemd/docker).
      if (url.pathname === "/health/live" && request.method === "GET") {
        return sendJson(response, 200, { status: "ok" });
      }
      if (url.pathname === "/health/ready" && request.method === "GET") {
        try {
          system.store.db.prepare("SELECT 1 AS ok").get();
          return sendJson(response, 200, { status: "ok", database: "ok" });
        } catch (dbError) {
          logger.error("health.ready.db_failure", { requestId, err: String(dbError?.message || dbError) });
          return sendJson(response, 503, { status: "unavailable", database: "unavailable" });
        }
      }

      // Rate limiting sur les surfaces sensibles (avant lecture du body).
      if (!enforceRateLimit(rateLimiters, url, request, response)) return;

      if (url.pathname === "/api/auth/request-code" && request.method === "POST") {
        const payload = await customerAuth.requestCode(await readJsonBody(request));
        return sendJson(response, 202, payload);
      }

      if (url.pathname === "/api/auth/signup" && request.method === "POST") {
        const result = customerAuth.createAccount(await readJsonBody(request));
        return sendJson(response, 201, { account: result.account }, {
          "Set-Cookie": buildSessionCookie(result.sessionToken, request),
        });
      }

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const result = customerAuth.loginWithPassword(await readJsonBody(request));
        return sendJson(response, 200, { account: result.account }, {
          "Set-Cookie": buildSessionCookie(result.sessionToken, request),
        });
      }

      if (url.pathname === "/api/auth/request-password-reset" && request.method === "POST") {
        const payload = await customerAuth.requestPasswordReset(await readJsonBody(request));
        return sendJson(response, 202, payload);
      }

      if (url.pathname === "/api/auth/confirm-password-reset" && request.method === "POST") {
        const result = customerAuth.confirmPasswordReset(await readJsonBody(request));
        return sendJson(response, 200, { account: result.account }, {
          "Set-Cookie": buildSessionCookie(result.sessionToken, request),
        });
      }

      if (url.pathname === "/api/auth/verify-code" && request.method === "POST") {
        const result = await customerAuth.verifyCode(await readJsonBody(request));
        return sendJson(response, 200, { account: result.account }, {
          "Set-Cookie": buildSessionCookie(result.sessionToken, request),
        });
      }

      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        const session = customerAuth.getSession(request);
        return sendJson(response, 200, { account: session?.account || null });
      }

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        customerAuth.destroySession(request);
        return sendJson(response, 200, { loggedOut: true }, {
          "Set-Cookie": buildSessionCookie("", request, 0),
        });
      }

      if (url.pathname === "/api/delivery-communes" && request.method === "GET") {
        return sendJson(response, 200, { communes: orders.listCommunes({ activeOnly: true }) });
      }

      if (url.pathname === "/api/orders" && request.method === "POST") {
        const body = await readJsonBody(request);
        const session = customerAuth.getSession(request);
        // Identite du client : quand la session est authentifiee, on IGNORE
        // firstName/lastName/phone/email du body et on force ceux du compte.
        // Empeche un client authentifie de passer une commande sous une fausse
        // identite (ou d ecraser son propre profil via le champ order).
        // Les infos de livraison (adresse, commune, coords, note) restent
        // propres a chaque commande et viennent bien du body.
        const orderBody = session
          ? {
            ...body,
            firstName: session.account.firstName,
            lastName: session.account.lastName,
            phone: session.account.phone,
            email: session.account.email,
          }
          : body;

        // Idempotency-Key : deux appels avec la meme cle et la meme identite
        // renvoient la meme reponse sans recreer de commande. Scope :
        // customerId (si authentifie) sinon IP+phone pour distinguer les
        // clients anonymes qui partagent une IP publique.
        const idempotencyKey = readIdempotencyKey(request);
        const idemScope = session?.account.id
          ? `cust:${session.account.id}`
          : `anon:${resolveClientIp(request)}:${String(orderBody?.phone || "").slice(0, 30)}`;
        if (idempotencyKey) {
          const existing = idempotencyStore.get(idemScope, idempotencyKey);
          if (existing && existing.status === "done") {
            return sendJson(response, 201, existing.response, { "Idempotent-Replay": "true" });
          }
          if (existing && existing.status === "in_flight") {
            return sendJson(response, 409, {
              error: { code: "IDEMPOTENCY_IN_FLIGHT", message: "Une commande avec cette clé est déjà en cours de traitement." },
            });
          }
          idempotencyStore.beginOrGet(idemScope, idempotencyKey);
        }

        try {
          const payload = {
            order: orders.createOrder(orderBody, { customerId: session?.account.id || null }),
          };
          if (idempotencyKey) idempotencyStore.complete(idemScope, idempotencyKey, payload);
          return sendJson(response, 201, payload);
        } catch (error) {
          if (idempotencyKey) idempotencyStore.release(idemScope, idempotencyKey);
          throw error;
        }
      }

      if (url.pathname === "/api/account/orders" && request.method === "GET") {
        const session = requireCustomerSession(customerAuth, request);
        return sendJson(response, 200, {
          orders: orders.listOrders({ customerId: session.account.id }),
          loyalty: loyalty.getCustomerProgress(session.account.id),
        });
      }

      if (url.pathname === "/api/menu" && request.method === "GET") {
        const payload = { menu: menu.listPublished({ category: url.searchParams.get("category") }) };
        return sendJson(response, 200, payload);
      }

      if (url.pathname === "/api/pasta-lover-club" && request.method === "GET") {
        return sendJson(response, 200, club.getContent());
      }

      if (url.pathname === "/api/analytics/events" && request.method === "POST") {
        const body = await readJsonBody(request);
        return sendJson(response, 202, analytics.recordEvent(body));
      }

      if (url.pathname === "/api/admin/menu" && request.method === "GET") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { menu: menu.listAdmin({ includeArchived: url.searchParams.get("includeArchived") === "true" }) });
      }

      if (url.pathname === "/api/admin/menu" && request.method === "POST") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 201, { menuItem: menu.create(await readJsonBody(request)) });
      }

      if (url.pathname === "/api/admin/delivery-communes" && request.method === "GET") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { communes: orders.listCommunes() });
      }

      if (url.pathname === "/api/admin/delivery-communes" && request.method === "POST") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 201, { commune: orders.createCommune(await readJsonBody(request)) });
      }

      const communeMatch = url.pathname.match(/^\/api\/admin\/delivery-communes\/([^/]+)$/);
      if (communeMatch && (request.method === "PATCH" || request.method === "PUT")) {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { commune: orders.updateCommune(decodeURIComponent(communeMatch[1]), await readJsonBody(request)) });
      }

      if (url.pathname === "/api/admin/orders" && request.method === "GET") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, {
          orders: orders.listOrders({
            status: url.searchParams.get("status"),
            from: url.searchParams.get("from"),
            to: url.searchParams.get("to"),
          }),
        });
      }

      const orderStatusMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
      if (orderStatusMatch && request.method === "PATCH") {
        assertAdminAuthorized(request, requiredAdminToken);
        const body = await readJsonBody(request);
        const orderId = decodeURIComponent(orderStatusMatch[1]);
        const order = orders.updateStatus(orderId, body.status, body.note);
        if (["delivered", "withdrawn", "completed"].includes(order.status) && order.customerId) {
          loyalty.syncCustomerRewards(order.customerId);
        }
        return sendJson(response, 200, {
          order,
        });
      }

      if (url.pathname === "/api/admin/loyalty" && request.method === "GET") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, {
          settings: loyalty.getSettings(),
          customers: loyalty.listCustomerProgress({ search: url.searchParams.get("search") || "" }),
        });
      }

      if (url.pathname === "/api/admin/loyalty" && (request.method === "PUT" || request.method === "PATCH")) {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { settings: loyalty.updateSettings(await readJsonBody(request)) });
      }

      const menuItemMatch = url.pathname.match(/^\/api\/admin\/menu\/([^/]+)$/);
      if (menuItemMatch && request.method === "PATCH") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { menuItem: menu.update(decodeURIComponent(menuItemMatch[1]), await readJsonBody(request)) });
      }

      const menuPublishMatch = url.pathname.match(/^\/api\/admin\/menu\/([^/]+)\/publish$/);
      if (menuPublishMatch && request.method === "POST") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { menuItem: menu.publish(decodeURIComponent(menuPublishMatch[1])) });
      }

      const menuAvailabilityMatch = url.pathname.match(/^\/api\/admin\/menu\/([^/]+)\/availability$/);
      if (menuAvailabilityMatch && request.method === "PATCH") {
        assertAdminAuthorized(request, requiredAdminToken);
        const body = await readJsonBody(request);
        return sendJson(response, 200, { menuItem: menu.setAvailability(decodeURIComponent(menuAvailabilityMatch[1]), body.available) });
      }

      const menuArchiveMatch = url.pathname.match(/^\/api\/admin\/menu\/([^/]+)$/);
      if (menuArchiveMatch && request.method === "DELETE") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { menuItem: menu.archive(decodeURIComponent(menuArchiveMatch[1])) });
      }

      const menuRestoreMatch = url.pathname.match(/^\/api\/admin\/menu\/([^/]+)\/restore$/);
      if (menuRestoreMatch && request.method === "POST") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { menuItem: menu.restore(decodeURIComponent(menuRestoreMatch[1])) });
      }

      const menuImageMatch = url.pathname.match(/^\/api\/admin\/menu\/([^/]+)\/image$/);
      if (menuImageMatch && request.method === "POST") {
        assertAdminAuthorized(request, requiredAdminToken);
        const form = await readMultipartFormData(request);
        const file = form.files.find((candidate) => candidate.fieldName === "image") || form.files[0];
        return sendJson(response, 201, { menuItem: await menu.uploadImage(decodeURIComponent(menuImageMatch[1]), file) });
      }

      if (menuImageMatch && request.method === "DELETE") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { menuItem: menu.removeImage(decodeURIComponent(menuImageMatch[1])) });
      }

      if (url.pathname === "/api/admin/revenue" && request.method === "GET") {
        assertAdminAuthorized(request, requiredAdminToken);
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        if (url.searchParams.get("entries") === "true") return sendJson(response, 200, { entries: analytics.listRevenue({ from, to }) });
        return sendJson(response, 200, analytics.getDashboard({ from, to, groupBy: url.searchParams.get("groupBy") || "day" }));
      }

      if (url.pathname === "/api/admin/revenue" && request.method === "PUT") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { revenue: analytics.upsertRevenue(await readJsonBody(request)) });
      }

      const revenueDateMatch = url.pathname.match(/^\/api\/admin\/revenue\/([^/]+)$/);
      if (revenueDateMatch && request.method === "DELETE") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, analytics.deleteRevenue(decodeURIComponent(revenueDateMatch[1])));
      }

      if (url.pathname === "/api/admin/analytics" && request.method === "GET") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, analytics.getDashboard({
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          groupBy: url.searchParams.get("groupBy") || "day",
        }));
      }

      if (url.pathname === "/api/admin/site-stats" && request.method === "GET") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, analytics.getSiteStats({
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          groupBy: url.searchParams.get("groupBy") || "day",
        }));
      }

      if (url.pathname === "/api/admin/pasta-lover-club" && request.method === "GET") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, club.getContent({ includeInactive: true }));
      }

      if (url.pathname === "/api/admin/pasta-lover-club" && (request.method === "PUT" || request.method === "PATCH")) {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, club.updateSettings(await readJsonBody(request)));
      }

      if (url.pathname === "/api/admin/pasta-lover-club/events" && request.method === "POST") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 201, { event: club.createEvent(await readJsonBody(request)) });
      }

      const clubEventMatch = url.pathname.match(/^\/api\/admin\/pasta-lover-club\/events\/([^/]+)$/);
      if (clubEventMatch && (request.method === "PATCH" || request.method === "PUT")) {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { event: club.updateEvent(decodeURIComponent(clubEventMatch[1]), await readJsonBody(request)) });
      }
      if (clubEventMatch && request.method === "DELETE") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { event: club.deleteEvent(decodeURIComponent(clubEventMatch[1])) });
      }


      // ═══ LIVREURS — Admin : gestion CRUD + assignation ═══
      if (url.pathname === "/api/admin/drivers" && request.method === "GET") {
        assertAdminAuthorized(request, requiredAdminToken);
        const includeInactive = url.searchParams.get("includeInactive") === "true";
        const list = drivers.list({ includeInactive });
        const enriched = list.map((driver) => ({ ...driver, stats: drivers.getStats(driver.id) }));
        return sendJson(response, 200, { drivers: enriched });
      }

      if (url.pathname === "/api/admin/drivers" && request.method === "POST") {
        assertAdminAuthorized(request, requiredAdminToken);
        const body = await readJsonBody(request);
        return sendJson(response, 201, { driver: drivers.create(body) });
      }

      const driverMatch = url.pathname.match(/^\/api\/admin\/drivers\/([^/]+)$/);
      if (driverMatch && request.method === "PATCH") {
        assertAdminAuthorized(request, requiredAdminToken);
        const body = await readJsonBody(request);
        return sendJson(response, 200, { driver: drivers.update(decodeURIComponent(driverMatch[1]), body) });
      }
      if (driverMatch && request.method === "DELETE") {
        assertAdminAuthorized(request, requiredAdminToken);
        return sendJson(response, 200, { driver: drivers.archive(decodeURIComponent(driverMatch[1])) });
      }

      const driverPinMatch = url.pathname.match(/^\/api\/admin\/drivers\/([^/]+)\/pin$/);
      if (driverPinMatch && request.method === "POST") {
        assertAdminAuthorized(request, requiredAdminToken);
        const body = await readJsonBody(request);
        drivers.resetPin(decodeURIComponent(driverPinMatch[1]), body.pin);
        return sendJson(response, 200, { reset: true });
      }

      const orderAssignMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/assign-driver$/);
      if (orderAssignMatch && request.method === "PATCH") {
        assertAdminAuthorized(request, requiredAdminToken);
        const body = await readJsonBody(request);
        if (body.driverId === null || body.driverId === "") {
          return sendJson(response, 200, drivers.unassignOrder(decodeURIComponent(orderAssignMatch[1])));
        }
        return sendJson(response, 200, drivers.assignOrder(decodeURIComponent(orderAssignMatch[1]), body.driverId));
      }

      // ═══ LIVREURS — Auth & espace livreur ═══
      if (url.pathname === "/api/driver/login" && request.method === "POST") {
        const body = await readJsonBody(request);
        const { sessionId, driver } = drivers.loginWithPin(body, {
          userAgent: request.headers["user-agent"] || "",
        });
        return sendJson(response, 200, { driver }, {
          "Set-Cookie": buildDriverSessionCookie(sessionId, request),
        });
      }

      if (url.pathname === "/api/driver/logout" && request.method === "POST") {
        drivers.destroySession(request);
        return sendJson(response, 200, { loggedOut: true }, {
          "Set-Cookie": buildDriverSessionCookie("", request, 0),
        });
      }

      if (url.pathname === "/api/driver/me" && request.method === "GET") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        return sendJson(response, 200, { driver: session.driver });
      }

      if (url.pathname === "/api/driver/status" && request.method === "PATCH") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        const body = await readJsonBody(request);
        return sendJson(response, 200, { driver: drivers.updateOwnStatus(session.driver.id, body.status) });
      }

      if (url.pathname === "/api/driver/orders" && request.method === "GET") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        return sendJson(response, 200, {
          orders: drivers.listActiveOrders(session.driver.id),
          history: drivers.listHistory(session.driver.id),
          stats: drivers.getStats(session.driver.id),
        });
      }

      // Pool des courses dispo (visible par tous les livreurs connectes).
      if (url.pathname === "/api/driver/pool" && request.method === "GET") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        return sendJson(response, 200, { pool: drivers.listPool() });
      }

      // Prendre atomiquement une course du pool.
      const driverTakeMatch = url.pathname.match(/^\/api\/driver\/orders\/([^/]+)\/take$/);
      if (driverTakeMatch && request.method === "POST") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        return sendJson(response, 200, drivers.takeOrder(session.driver.id, decodeURIComponent(driverTakeMatch[1])));
      }

      // Relâcher une course (retour au pool).
      const driverReleaseMatch = url.pathname.match(/^\/api\/driver\/orders\/([^/]+)\/release$/);
      if (driverReleaseMatch && request.method === "POST") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        return sendJson(response, 200, drivers.releaseOrder(session.driver.id, decodeURIComponent(driverReleaseMatch[1])));
      }

      // Annuler une course (client injoignable, mauvaise adresse, refus).
      const driverCancelMatch = url.pathname.match(/^\/api\/driver\/orders\/([^/]+)\/cancel$/);
      if (driverCancelMatch && request.method === "POST") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        const body = await readJsonBody(request);
        return sendJson(response, 200, drivers.markCancelledByDriver(session.driver.id, decodeURIComponent(driverCancelMatch[1]), body.reason));
      }

      const driverOrderStartMatch = url.pathname.match(/^\/api\/driver\/orders\/([^/]+)\/start$/);
      if (driverOrderStartMatch && request.method === "POST") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        return sendJson(response, 200, drivers.markInTransit(session.driver.id, decodeURIComponent(driverOrderStartMatch[1])));
      }

      const driverOrderDeliverMatch = url.pathname.match(/^\/api\/driver\/orders\/([^/]+)\/delivered$/);
      if (driverOrderDeliverMatch && request.method === "POST") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        return sendJson(response, 200, drivers.markDelivered(session.driver.id, decodeURIComponent(driverOrderDeliverMatch[1])));
      }

      if (url.pathname === "/api/driver/push/subscribe" && request.method === "POST") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        const body = await readJsonBody(request);
        drivers.savePushSubscription(session.driver.id, body);
        return sendJson(response, 200, { subscribed: true });
      }

      if (url.pathname.startsWith("/api/")) {
        return sendJson(response, 404, {
          error: {
            code: "NOT_FOUND",
            message: "Endpoint not found.",
          },
        });
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        return sendText(response, 405, "Method not allowed");
      }

      return serveStatic(url.pathname, request.method, response);
    } catch (error) {
      if (error instanceof ReservationError || error instanceof MenuError || error instanceof OrderError || error instanceof LoyaltyError || error instanceof AnalyticsError || error instanceof CustomerAuthError || error instanceof ClubError || error instanceof DriverError) {
        return sendJson(response, error.status, {
          error: {
            code: error.code,
            message: error.message,
            ...error.details,
          },
        });
      }

      if (error.code === "ADMIN_UNAUTHORIZED") {
        return sendJson(response, 401, {
          error: {
            code: "ADMIN_UNAUTHORIZED",
            message: "Admin authorization is required.",
          },
        });
      }

      if (error.code === "REQUEST_BODY_INVALID") {
        return sendJson(response, 400, {
          error: {
            code: "REQUEST_BODY_INVALID",
            message: "Request body must be valid JSON.",
          },
        });
      }

      logger.error("server.internal_error", {
        requestId,
        method: request.method,
        path: url?.pathname,
        err: String(error?.message || error),
      });
      return sendJson(response, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected reservation service error.",
        },
      });
    }
  });
}

function assertAdminAuthorized(request, requiredAdminToken) {
  // Sans GALATEE_ADMIN_TOKEN configure : mode developpement local, routes admin
  // ouvertes. Le check "prod exige un token" est fait au demarrage (voir bloc
  // `if (process.argv[1] === ...)` en bas de fichier) pour eviter un crash a
  // chaque requete si l env est manquante.
  if (!requiredAdminToken) return;

  const header = String(request.headers.authorization || "");
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!safeTokenCompare(provided, requiredAdminToken)) {
    const error = new Error("Admin authorization is required.");
    error.code = "ADMIN_UNAUTHORIZED";
    throw error;
  }
}

function requireCustomerSession(customerAuth, request) {
  const session = customerAuth.getSession(request);
  if (session) return session;
  throw new CustomerAuthError("AUTH_UNAUTHORIZED", "A customer account is required.", 401);
}

// Applique le rate limiter approprie a la surface demandee. Retourne false si
// un 429 a deja ete envoye (l'appelant doit alors s'arreter immediatement).
function enforceRateLimit(limiters, url, request, response) {
  const method = request.method;
  const pathname = url.pathname;
  if (method === "POST") {
    if (
      pathname === "/api/auth/login"
      || pathname === "/api/auth/signup"
      || pathname === "/api/auth/request-code"
      || pathname === "/api/auth/request-password-reset"
      || pathname === "/api/auth/confirm-password-reset"
      || pathname === "/api/auth/verify-code"
    ) {
      return applyRateLimit(limiters.auth, request, response, "customer-auth");
    }
    if (pathname === "/api/driver/login") {
      return applyRateLimit(limiters.auth, request, response, "driver-login");
    }
    if (pathname === "/api/orders") {
      return applyRateLimit(limiters.order, request, response, "order");
    }
    if (pathname === "/api/analytics/events") {
      return applyRateLimit(limiters.analytics, request, response, "analytics");
    }
    if (/^\/api\/admin\/menu\/[^/]+\/image$/.test(pathname)) {
      return applyRateLimit(limiters.upload, request, response, "menu-image");
    }
  }
  if (pathname.startsWith("/api/admin/")) {
    return applyRateLimit(limiters.admin, request, response, "admin");
  }
  return true;
}

async function serveStatic(pathname, method, response) {
  if (pathname.startsWith("/uploads/menu/")) {
    const requestedUpload = safeJoin(menuUploadDir, pathname.slice("/uploads/menu/".length));
    if (!requestedUpload) return sendText(response, 403, "Forbidden");
    if (!(await fileExists(requestedUpload))) return sendText(response, 404, "Not found");
    return sendFile(requestedUpload, method, response, false);
  }

  const isLegacyAdmin = pathname === "/admin.html" || pathname === "/admin.css" || pathname === "/admin.js" || pathname === "/admin-calendar.js";
  const hasReactBuild = await fileExists(join(reactDistDir, "index.html"));

  if (hasReactBuild && !isLegacyAdmin) {
    if (pathname === "/favicon.ico") {
      return sendFile(join(reactDistDir, "favicon.svg"), method, response, false);
    }

    const requestedPath = safeJoin(reactDistDir, pathname === "/" ? "/index.html" : pathname);
    if (!requestedPath) return sendText(response, 403, "Forbidden");

    if (await fileExists(requestedPath)) {
      return sendFile(requestedPath, method, response, requestedPath.endsWith("index.html"));
    }

    if (pathname === "/index.html" || !extname(pathname)) {
      return sendFile(join(reactDistDir, "index.html"), method, response, true);
    }

    return sendText(response, 404, "Not found");
  }

  const requestedPath = safeJoin(frontendDir, pathname === "/" ? "/index.html" : pathname);
  if (!requestedPath) return sendText(response, 403, "Forbidden");
  if (!(await fileExists(requestedPath))) return sendText(response, 404, "Not found");
  return sendFile(requestedPath, method, response, requestedPath.endsWith("index.html"));
}

function safeJoin(baseDir, pathname) {
  const requestedPath = normalize(join(baseDir, pathname));
  return requestedPath === baseDir || requestedPath.startsWith(`${baseDir}${sep}`) ? requestedPath : null;
}

async function fileExists(pathname) {
  try {
    await readFile(pathname);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function sendFile(pathname, method, response, injectApi = false) {
  let content = await readFile(pathname);
  const extension = extname(pathname);
  if (injectApi) content = Buffer.from(injectApiConfig(content.toString("utf8")), "utf8");
  response.writeHead(200, {
    "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
    "Content-Length": content.byteLength,
    "Cache-Control": "no-store",
  });
  response.end(method === "HEAD" ? undefined : content);
}

function injectApiConfig(html) {
  const config = '<script>window.GALATEE_API_BASE = "/api";</script>';
  return html.replace("</head>", `${config}</head>`);
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 32_000) {
      throw new ReservationError("REQUEST_BODY_TOO_LARGE", "Request body is too large.", 413);
    }
  }

  try {
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    error.code = "REQUEST_BODY_INVALID";
    throw error;
  }
}

async function readMultipartFormData(request) {
  const contentType = String(request.headers["content-type"] || "");
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new MenuError("MULTIPART_INVALID", "Multipart form data is required for image upload.", 400);
  }
  const body = await readRawBody(request, 5 * 1024 * 1024 + 128 * 1024);
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = splitBuffer(body, boundary);
  const fields = {};
  const files = [];

  for (const rawPart of parts) {
    let part = rawPart;
    if (part.subarray(0, 2).equals(Buffer.from("\r\n"))) part = part.subarray(2);
    if (part.length < 4 || part.subarray(-2).equals(Buffer.from("--"))) continue;
    if (part.subarray(-2).equals(Buffer.from("\r\n"))) part = part.subarray(0, -2);
    const separator = part.indexOf(Buffer.from("\r\n\r\n"));
    if (separator < 0) continue;
    const headers = part.subarray(0, separator).toString("utf8");
    const data = part.subarray(separator + 4);
    const disposition = headers.match(/content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
    if (!disposition) continue;
    const fieldName = disposition[1];
    const filename = disposition[2];
    const typeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
    if (filename !== undefined) files.push({ fieldName, filename, contentType: typeMatch?.[1]?.trim() || "", data });
    else fields[fieldName] = data.toString("utf8");
  }

  return { fields, files };
}

async function readRawBody(request, maxBytes) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > maxBytes) throw new MenuError("REQUEST_BODY_TOO_LARGE", "Request body is too large.", 413);
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new MenuError("REQUEST_BODY_TOO_LARGE", "Request body is too large.", 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  while (start <= buffer.length) {
    const index = buffer.indexOf(separator, start);
    if (index < 0) {
      parts.push(buffer.subarray(start));
      break;
    }
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
  }
  return parts;
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, message) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(message);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // ── Verrous de demarrage en production ────────────────────────────────
  // On refuse le boot plutot que de logger un warning : mieux vaut un service
  // qui ne demarre pas qu un backend prod ouvert.
  if (IS_PRODUCTION) {
    const missing = [];
    if (!adminToken) missing.push("GALATEE_ADMIN_TOKEN");
    try { resolveCorsOrigin(allowedOrigin); } catch (err) { missing.push("GALATEE_ALLOWED_ORIGIN"); }
    if (missing.length) {
      console.error(`Refusing to start in production: missing env vars: ${missing.join(", ")}.`);
      process.exit(1);
    }
  } else if (!adminToken) {
    console.warn(
      "\nWarning: GALATEE_ADMIN_TOKEN is not set - every /api/admin/* route is " +
      "reachable with no login right now. Fine for local testing; set a real " +
      "token before this server is reachable from outside your own machine.\n",
    );
  }

  const server = createApp();
  server.listen(port, () => {
    logger.info("server.listen", { port, env: process.env.NODE_ENV || "development" });
    console.log(`Galatee reservation server listening on http://localhost:${port}`);
  });

  // ── Arret propre : SIGTERM/SIGINT ferment les connexions HTTP puis la DB.
  // Docker / systemd envoient SIGTERM ; Ctrl+C envoie SIGINT.
  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("server.shutdown.start", { signal });
    // 10 s max : au-dela, on force la sortie pour ne pas bloquer un deploy.
    const forceTimer = setTimeout(() => {
      logger.error("server.shutdown.force_exit", { signal });
      process.exit(1);
    }, 10_000);
    forceTimer.unref?.();
    server.close(() => {
      try { reservationSystem.store.close?.(); } catch { /* ignore */ }
      logger.info("server.shutdown.done", { signal });
      clearTimeout(forceTimer);
      process.exit(0);
    });
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
