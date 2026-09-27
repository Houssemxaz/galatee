import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./server.js";
import { ReservationSystem, SqliteReservationStore } from "./reservationSystem.js";

// Le systeme de reservation a ete retire cote API, mais SqliteReservationStore
// reste utilise en interne comme host SQLite (schemas + connexion partagee).
// Les tests ici verifient uniquement les comportements HTTP transverses :
// CORS, auth admin, redirection frontend, injection de la base API.

const TEST_ADMIN_TOKEN = "test-admin-token";

async function createTestServer(t, { requiredAdminToken = TEST_ADMIN_TOKEN, corsAllowedOrigin } = {}) {
  const store = new SqliteReservationStore();
  const system = new ReservationSystem({ store });
  const server = createApp({
    system,
    requiredAdminToken,
    ...(corsAllowedOrigin ? { corsAllowedOrigin } : {}),
  });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  t.after(() => store.close());
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

test("HTTP admin API requires bearer auth when an admin token is configured", async (t) => {
  const baseUrl = await createTestServer(t, {
    corsAllowedOrigin: "https://demo-galatee.vercel.app",
  });

  const preflightResponse = await fetch(`${baseUrl}/api/admin/menu`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://demo-galatee.vercel.app",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  assert.equal(preflightResponse.status, 204);
  assert.equal(preflightResponse.headers.get("access-control-allow-origin"), "https://demo-galatee.vercel.app");
  assert.match(preflightResponse.headers.get("access-control-allow-methods") || "", /OPTIONS/);
  assert.match(preflightResponse.headers.get("access-control-allow-headers") || "", /Content-Type/);
  assert.match(preflightResponse.headers.get("access-control-allow-headers") || "", /Authorization/);
  assert.match(preflightResponse.headers.get("access-control-allow-headers") || "", /Idempotency-Key/);

  const unauthorizedResponse = await fetch(`${baseUrl}/api/admin/menu`);
  assert.equal(unauthorizedResponse.status, 401);

  const authorizedResponse = await fetch(`${baseUrl}/api/admin/menu`, {
    headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
  });
  assert.equal(authorizedResponse.status, 200);
});

test("HTTP admin API stays open when no admin token is configured at all (intentional)", async (t) => {
  // Choix delibere : sans GALATEE_ADMIN_TOKEN, les routes admin sont accessibles
  // sans login pour matcher le "Token admin optionnel" du back-office.
  const baseUrl = await createTestServer(t, { requiredAdminToken: "" });
  const noHeaderResponse = await fetch(`${baseUrl}/api/admin/menu`);
  assert.equal(noHeaderResponse.status, 200);
});

test("HTTP server injects the API base when serving the frontend", async (t) => {
  const baseUrl = await createTestServer(t);
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /window\.GALATEE_API_BASE = "\/api"/);
});

test("HTTP API returns 404 with structured error for unknown routes", async (t) => {
  const baseUrl = await createTestServer(t);
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(typeof body.error?.code, "string");
});
