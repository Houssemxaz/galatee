import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { dirname, extname, join, normalize, sep } from "node:path";
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
import { PostgresSyncDatabase } from "./postgres/syncDatabase.js";

const rootDir = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const frontendDir = join(rootDir, "frontend");
const reactDistDir = join(rootDir, "frontend-react", "dist");
const databasePath = join(rootDir, "backend", "data", "galatee.sqlite");
const menuUploadDir = join(rootDir, "backend", "data", "uploads", "menu");
const port = Number(process.env.PORT || 3000);
const adminToken = process.env.GALATEE_ADMIN_TOKEN || "";
const allowedOrigin = process.env.GALATEE_ALLOWED_ORIGIN || "*";
const usePostgres = (process.env.GALATEE_DATABASE || "sqlite").toLowerCase() === "postgres";
const runtimeDatabase = usePostgres
  ? new PostgresSyncDatabase({ connectionString: process.env.DATABASE_URL })
  : openSqliteDatabase(databasePath);

const menuSystem = new MenuSystem({ db: runtimeDatabase, uploadRoot: menuUploadDir });
const loyaltySystem = new LoyaltySystem({ db: runtimeDatabase });
const orderSystem = new OrderSystem({ db: runtimeDatabase, menu: menuSystem, loyalty: loyaltySystem });
const analyticsSystem = new AnalyticsSystem({ db: runtimeDatabase });
const customerAuthSystem = new CustomerAuthSystem({ db: runtimeDatabase });
const clubSystem = new ClubSystem({ db: runtimeDatabase });
const driverSystem = new DriverSystem({ db: runtimeDatabase });

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
  menu = menuSystem,
  orders = orderSystem,
  loyalty = loyaltySystem,
  analytics = analyticsSystem,
  customerAuth = customerAuthSystem,
  club = clubSystem,
  drivers = driverSystem,
  requiredAdminToken = adminToken,
  corsAllowedOrigin = allowedOrigin,
} = {}) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      applyCorsHeaders(response, corsAllowedOrigin);

      if (request.method === "OPTIONS") {
        response.writeHead(204, { "Content-Length": "0" });
        response.end();
        return;
      }

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
        const orderBody = session
          ? {
            ...body,
            firstName: body.firstName || session.account.firstName,
            lastName: body.lastName || session.account.lastName,
            phone: body.phone || session.account.phone,
            email: body.email || session.account.email,
          }
          : body;
        return sendJson(response, 201, {
          order: orders.createOrder(orderBody, { customerId: session?.account.id || null }),
        });
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
        const previous = orders.getOrder(orderId);
        const order = body.correction
          ? orders.correctStatus(orderId, body.status, body.note)
          : orders.updateStatus(orderId, body.status, body.note);
        const loyaltyStatuses = new Set(["delivered", "withdrawn", "completed"]);
        if ((loyaltyStatuses.has(order.status) || loyaltyStatuses.has(previous?.status)) && order.customerId) {
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
        if (body.deliveryAttempt === true) {
          return sendJson(response, 200, drivers.markDeliveryCancelledByDriver(session.driver.id, decodeURIComponent(driverCancelMatch[1]), body.reason));
        }
        return sendJson(response, 200, drivers.markCancelledByDriver(session.driver.id, decodeURIComponent(driverCancelMatch[1]), body.reason));
      }

      // Annuler une livraison après le départ (client absent, refus ou problème à l'arrivée).
      const driverDeliveryCancelMatch = url.pathname.match(/^\/api\/driver\/orders\/([^/]+)\/cancel-delivery$/);
      if (driverDeliveryCancelMatch && request.method === "POST") {
        const session = drivers.getSession(request);
        if (!session) return sendJson(response, 401, { error: { code: "DRIVER_UNAUTHENTICATED", message: "Non connecté." } });
        const body = await readJsonBody(request);
        return sendJson(response, 200, drivers.markDeliveryCancelledByDriver(session.driver.id, decodeURIComponent(driverDeliveryCancelMatch[1]), body.reason));
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
      if (error instanceof MenuError || error instanceof OrderError || error instanceof LoyaltyError || error instanceof AnalyticsError || error instanceof CustomerAuthError || error instanceof ClubError || error instanceof DriverError) {
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

      if (error.code === "REQUEST_BODY_TOO_LARGE") {
        return sendJson(response, 413, {
          error: {
            code: "REQUEST_BODY_TOO_LARGE",
            message: "Request body is too large.",
          },
        });
      }

      console.error(error);
      return sendJson(response, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server error.",
        },
      });
    }
  });
}

function assertAdminAuthorized(request, requiredAdminToken) {
  // Intentionally optional: with no token configured, admin routes are open.
  // This is a deliberate convenience for local development (see the "Token
  // admin optionnel" field in the back-office AuthGate screen) - set
  // GALATEE_ADMIN_TOKEN before exposing this server publicly.
  if (!requiredAdminToken) return;

  const expectedHeader = `Bearer ${requiredAdminToken}`;
  if (request.headers.authorization !== expectedHeader) {
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

function applyCorsHeaders(response, origin) {
  const normalizedOrigin = String(origin || "*").trim() || "*";
  response.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (normalizedOrigin !== "*") {
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }
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
      const error = new Error("Request body is too large.");
      error.code = "REQUEST_BODY_TOO_LARGE";
      throw error;
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
  if (!adminToken) {
    console.warn(
      "\nWarning: GALATEE_ADMIN_TOKEN is not set - every /api/admin/* route is " +
      "reachable with no login right now. Fine for local testing; set a real " +
      "token before this server is reachable from outside your own machine.\n",
    );
  }

  createApp().listen(port, () => {
    console.log(`Galatee database mode: ${usePostgres ? "PostgreSQL" : "SQLite"}`);
    console.log(`Galatee order server listening on http://localhost:${port}`);
  });
}

function openSqliteDatabase(pathname) {
  mkdirSync(dirname(pathname), { recursive: true });
  const db = new DatabaseSync(pathname);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  return db;
}
