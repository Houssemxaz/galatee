import { expect, test } from "@playwright/test";

const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN || "e2e-admin-token-abcdef";

test("backoffice refuse les requetes admin sans token", async ({ request }) => {
  const noHeader = await request.get("/api/admin/menu");
  expect(noHeader.status()).toBe(401);

  const badHeader = await request.get("/api/admin/menu", {
    headers: { Authorization: "Bearer WRONG-TOKEN" },
  });
  expect(badHeader.status()).toBe(401);

  const good = await request.get("/api/admin/menu", {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  expect(good.status()).toBe(200);
});

test("backoffice UI charge la section Commandes avec le bon token", async ({ page }) => {
  // Le token est stocke par le backoffice dans sessionStorage sous la cle
  // "galatee.adminToken" (voir frontend-react/src/backoffice/api.js). On l
  // injecte avant le premier document pour simuler un admin deja loggue.
  await page.addInitScript((token) => {
    try { window.sessionStorage.setItem("galatee.adminToken", token); } catch { /* private mode */ }
  }, ADMIN_TOKEN);

  await page.goto("/backoffice.html");

  // Le shell backoffice charge la liste des commandes via /api/admin/orders.
  const ordersResponse = await page.waitForResponse(
    (r) => r.url().includes("/api/admin/orders") && r.request().method() === "GET",
    { timeout: 15_000 },
  );
  expect(ordersResponse.status()).toBe(200);

  // Le shell affiche bien les sections principales.
  await expect(page.getByRole("heading", { name: /Commandes/i, level: 1 })).toBeVisible();
});
