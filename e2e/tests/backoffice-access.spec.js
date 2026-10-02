import { test, expect } from "@playwright/test";
import { ADMIN_TOKEN } from "./helpers.js";

test("le back-office refuse les requêtes anonymes et accepte le token admin", async ({ page, request }) => {
  const anonymous = await request.get("/api/admin/orders");
  expect(anonymous.status()).toBe(401);

  const wrong = await request.get("/api/admin/orders", {
    headers: { Authorization: "Bearer wrong-token" },
  });
  expect(wrong.status()).toBe(401);

  const authorized = await request.get("/api/admin/orders", {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  expect(authorized.status()).toBe(200);

  await page.addInitScript((token) => sessionStorage.setItem("galatee.adminToken", token), ADMIN_TOKEN);
  const ordersResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/admin/orders") && response.request().method() === "GET",
  );
  await page.goto("/backoffice.html");
  await ordersResponse;
  await expect(page.getByRole("heading", { name: "Commandes", exact: true }).first()).toBeVisible();
});
