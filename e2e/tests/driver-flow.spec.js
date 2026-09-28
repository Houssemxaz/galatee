import { expect, test } from "@playwright/test";

// L admin token doit matcher le E2E_ADMIN_TOKEN de test-server.mjs.
const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN || "e2e-admin-token-abcdef";
const DRIVER_PHONE = "+213 555 000 001";
const DRIVER_PIN = "1234";

// Helper : cree une commande delivery pending, puis la fait passer en
// "confirmed" via l API admin pour qu elle apparaisse dans le pool livreur.
async function seedConfirmedOrder(request, { firstName = "Client", coords = null } = {}) {
  // Recupere l id du plat seede en listant le menu public.
  const menuResponse = await request.get("/api/menu");
  const menu = await menuResponse.json();
  const dish = menu.menu.find((item) => /E2E/i.test(item.title));
  expect(dish, "Le plat E2E doit etre seede").toBeTruthy();

  const orderBody = {
    firstName,
    lastName: "Livreur",
    phone: "+213555222333",
    email: `${firstName.toLowerCase()}@example.com`,
    deliveryMode: "delivery",
    communeId: "hydra",
    deliveryAddress: `Adresse test ${firstName}`,
    items: [{ productId: dish.id, quantity: 1 }],
    ...(coords ? { deliveryLatitude: coords.lat, deliveryLongitude: coords.lng } : {}),
  };
  const orderResponse = await request.post("/api/orders", { data: orderBody });
  expect(orderResponse.status()).toBe(201);
  const { order } = await orderResponse.json();

  const confirmResponse = await request.patch(`/api/admin/orders/${order.id}/status`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    data: { status: "confirmed" },
  });
  expect(confirmResponse.status()).toBe(200);
  return order;
}

async function loginDriver(page) {
  await page.goto("/livreur");
  await expect(page).toHaveURL(/\/livreur\/login$/);
  await page.getByPlaceholder(/^\+213/).fill(DRIVER_PHONE);
  await page.getByPlaceholder(/^••••$/).fill(DRIVER_PIN);
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await expect(page).toHaveURL(/\/livreur\/?$/);
}

test("livreur peut se connecter, prendre une course et la marquer livree", async ({ page, request }) => {
  const order = await seedConfirmedOrder(request, { firstName: "OrderDelivered" });

  await test.step("login livreur", async () => {
    await loginDriver(page);
  });

  await test.step("prend la course depuis le pool", async () => {
    // Le pool est rafraichi toutes les 8s ; on force le rafraichissement en
    // attendant un fetch de /api/driver/pool apres notre seed.
    const shortNumber = order.orderNumber.split("-").pop();
    const orderCard = page.locator("article.pbg-drv-card-pool").filter({
      hasText: `#${shortNumber}`,
    });
    await expect(orderCard).toBeVisible({ timeout: 15_000 });
    await orderCard.getByRole("button", { name: /Prendre cette course/i }).click();
    await expect(page.locator("article.pbg-drv-card-mine").filter({ hasText: `#${shortNumber}` })).toBeVisible();
  });

  await test.step("marque prete cote admin puis livree cote livreur", async () => {
    // Le status doit etre "ready" pour marquer livree. On declenche cote admin
    // (le staff cuisine le ferait via le backoffice).
    const readyResponse = await request.patch(`/api/admin/orders/${order.id}/status`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      data: { status: "ready" },
    });
    expect(readyResponse.status()).toBe(200);

    // Cote livreur, on clique sur "Je pars livrer" puis "Livrée et encaissée".
    const shortNumber = order.orderNumber.split("-").pop();
    const mineCard = page.locator("article.pbg-drv-card-mine").filter({ hasText: `#${shortNumber}` });
    // On attend que la carte reflete le status "ready" apres le prochain polling
    // ou on force un rechargement.
    await page.reload();
    await loginRedirectGuard(page);
    const refreshedCard = page.locator("article.pbg-drv-card-mine").filter({ hasText: `#${shortNumber}` });
    await refreshedCard.getByRole("button", { name: /Je pars livrer/i }).click();
    await refreshedCard.getByRole("button", { name: /Livrée/i }).click();
    // Une confirmation modale peut s'afficher pour valider l encaissement cash.
    const confirmBtn = page.getByRole("button", { name: /Confirmer/i });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }

    // La carte doit disparaitre des courses actives.
    await expect(refreshedCard).toBeHidden({ timeout: 10_000 });
  });
});

test("livreur peut annuler une course avec un motif", async ({ page, request }) => {
  const order = await seedConfirmedOrder(request, { firstName: "OrderCancelled" });
  await loginDriver(page);

  const shortNumber = order.orderNumber.split("-").pop();
  const poolCard = page.locator("article.pbg-drv-card-pool").filter({ hasText: `#${shortNumber}` });
  await expect(poolCard).toBeVisible({ timeout: 15_000 });
  await poolCard.getByRole("button", { name: /Prendre cette course/i }).click();

  const mineCard = page.locator("article.pbg-drv-card-mine").filter({ hasText: `#${shortNumber}` });
  await mineCard.getByRole("button", { name: /Annuler/i }).click();

  // Une modale demande un motif. On selectionne "Client injoignable".
  const reasonOption = page.getByLabel(/Client injoignable/i);
  await reasonOption.check();
  await page.getByRole("button", { name: /Valider l'annulation|Confirmer/i }).click();

  await expect(mineCard).toBeHidden({ timeout: 10_000 });
});

async function loginRedirectGuard(page) {
  if (/\/livreur\/login$/.test(page.url())) {
    await page.getByPlaceholder(/^\+213/).fill(DRIVER_PHONE);
    await page.getByPlaceholder(/^••••$/).fill(DRIVER_PIN);
    await page.getByRole("button", { name: /Se connecter/i }).click();
  }
}
