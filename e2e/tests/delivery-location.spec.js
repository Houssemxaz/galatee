import { expect, test } from "@playwright/test";

// Point exact de livraison sans carte : permission de localisation demandee
// des l arrivee, puis deux options au checkout (position exacte / lien
// Google Maps colle). Pour chaque commande on verifie ce que recoit le
// livreur : lien de navigation exact si un point a ete fourni, sinon
// recherche textuelle sur l adresse.

const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN || "e2e-admin-token-abcdef";
const DRIVER_PHONE = "+213 555 000 001";
const DRIVER_PIN = "1234";
const HYDRA = { latitude: 36.7503, longitude: 3.0441 };
const GEO_KEY = "galatee.geolocation";

function exactNavigationHref(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

async function readGeolocationStore(page) {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null"), GEO_KEY);
}

async function goToCheckout(page, firstName) {
  await page.goto("/commande");
  const addChip = page.getByRole("button", { name: /Spaghetti Pomodoro E2E/i }).first();
  await expect(addChip).toBeVisible({ timeout: 15_000 });
  await addChip.click();
  await page.getByRole("button", { name: /Confirmer ma sélection/i }).click();
  await expect(page).toHaveURL(/\/commande\/coordonnees$/);

  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill(firstName);
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Localisation");
  await page.getByRole("textbox", { name: /Téléphone/i }).fill("+213555111222");
  await page.getByRole("combobox", { name: /Commune/i }).selectOption("hydra");
  await page.getByRole("textbox", { name: /Adresse de livraison/i }).fill(`Adresse ${firstName}, Hydra`);
  // Plus de carte Leaflet sur la page.
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
}

async function submitOrder(page) {
  const submitPromise = page.waitForResponse(
    (r) => r.url().includes("/api/orders") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Envoyer ma commande/i }).click();
  const response = await submitPromise;
  expect(response.status()).toBe(201);
  const { order } = await response.json();
  return order;
}

// Confirme la commande cote admin, connecte le livreur, prend la course et
// renvoie le lien Google Maps affiche sur sa carte.
async function driverMapsHref(page, request, order) {
  const confirm = await request.patch(`/api/admin/orders/${order.id}/status`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    data: { status: "confirmed" },
  });
  expect(confirm.status()).toBe(200);

  // Chaque test a un contexte neuf : le livreur n est jamais deja connecte.
  await page.goto("/livreur");
  await expect(page).toHaveURL(/\/livreur\/login$/);
  await page.getByPlaceholder(/^\+213/).fill(DRIVER_PHONE);
  await page.getByPlaceholder(/^••••$/).fill(DRIVER_PIN);
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await expect(page).toHaveURL(/\/livreur\/?$/);

  const shortNumber = order.orderNumber.split("-").pop();
  const poolCard = page.locator("article.pbg-drv-card-pool").filter({ hasText: `#${shortNumber}` });
  await expect(poolCard).toBeVisible({ timeout: 15_000 });
  await poolCard.getByRole("button", { name: /Prendre cette course/i }).click();

  const mineCard = page.locator("article.pbg-drv-card-mine").filter({ hasText: `#${shortNumber}` });
  await expect(mineCard).toBeVisible();
  return mineCard.locator("a.pbg-drv-link-chip").first().getAttribute("href");
}

test.describe("permission de localisation accordee", () => {
  test.use({ permissions: ["geolocation"], geolocation: HYDRA });

  test("la position est obtenue des l arrivee sur le site, avant le checkout", async ({ page }) => {
    await page.goto("/");
    await expect.poll(async () => (await readGeolocationStore(page))?.status).toBe("granted");
    const stored = await readGeolocationStore(page);
    expect(stored.position).toMatchObject(HYDRA);
  });

  test("position exacte : coordonnees envoyees, lien de navigation exact pour le livreur", async ({ page, request }) => {
    await goToCheckout(page, "Position");
    await page.getByRole("button", { name: /Utiliser ma position exacte/i }).click();
    await expect(page.getByText(/Point enregistré \(votre position\)/)).toBeVisible();

    const order = await submitOrder(page);
    expect(order.deliveryLatitude).toBe(HYDRA.latitude);
    expect(order.deliveryLongitude).toBe(HYDRA.longitude);

    const href = await driverMapsHref(page, request, order);
    expect(href).toBe(exactNavigationHref(HYDRA.latitude, HYDRA.longitude));
  });
});

test("lien Google Maps complet : point detecte, confirme puis transmis au livreur", async ({ page, request }) => {
  await goToCheckout(page, "Lien");
  const link = "https://www.google.com/maps/place/Hydra/@36.748,3.035,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d36.7512!4d3.0398!16s";
  await page.getByRole("textbox", { name: /Coller un lien Google Maps/i }).fill(link);

  // Le point detecte est montre au client mais pas applique tant qu il n a pas confirme.
  await expect(page.getByText("36.75120° N, 3.03980° E")).toBeVisible();
  await expect(page.getByText(/Aucun point enregistré/)).toBeVisible();
  await page.getByRole("button", { name: /Utiliser ce point/i }).click();
  await expect(page.getByText(/Point enregistré \(lien Google Maps\)/)).toBeVisible();

  const order = await submitOrder(page);
  expect(order.deliveryLatitude).toBe(36.7512);
  expect(order.deliveryLongitude).toBe(3.0398);

  const href = await driverMapsHref(page, request, order);
  expect(href).toBe(exactNavigationHref(36.7512, 3.0398));
});

test("lien court maps.app.goo.gl : message clair, aucune coordonnee envoyee", async ({ page, request }) => {
  await goToCheckout(page, "Court");
  await page.getByRole("textbox", { name: /Coller un lien Google Maps/i }).fill("https://maps.app.goo.gl/AbCdEf123456");

  await expect(page.getByText(/ne sont pas pris en charge/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Utiliser ce point/i })).toHaveCount(0);
  await expect(page.getByText(/Aucun point enregistré/)).toBeVisible();

  const order = await submitOrder(page);
  expect(order.deliveryLatitude).toBeNull();
  expect(order.deliveryLongitude).toBeNull();

  // Sans point exact, le livreur garde la recherche sur l adresse texte.
  const href = await driverMapsHref(page, request, order);
  expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Adresse%20Court/);
});

test("permission refusee : message au checkout, le lien reste possible", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await readGeolocationStore(page))?.status).toBe("denied");

  await goToCheckout(page, "Refus");
  await page.getByRole("button", { name: /Utiliser ma position exacte/i }).click();
  await expect(page.getByText(/Localisation refusée\. Autorisez-la/)).toBeVisible();
  await expect(page.getByText(/Aucun point enregistré/)).toBeVisible();
});

test("demande automatique ignoree par le navigateur : relancee au premier geste", async ({ page }) => {
  // Simule un navigateur qui ignore la demande sans geste utilisateur : le
  // premier appel ne repond jamais, les suivants repondent normalement.
  await page.addInitScript(({ latitude, longitude }) => {
    let calls = 0;
    const geolocation = {
      getCurrentPosition(success) {
        calls += 1;
        window.__geoCalls = calls;
        if (calls === 1) return;
        setTimeout(() => success({ coords: { latitude, longitude, accuracy: 12 }, timestamp: Date.now() }), 20);
      },
      watchPosition() { return 0; },
      clearWatch() {},
    };
    Object.defineProperty(navigator, "geolocation", { value: geolocation, configurable: true });
    Object.defineProperty(navigator, "permissions", {
      value: { query: async () => ({ state: "prompt", addEventListener() {}, removeEventListener() {} }) },
      configurable: true,
    });
  }, HYDRA);

  await page.goto("/");
  await expect.poll(async () => (await readGeolocationStore(page))?.status ?? "idle").not.toBe("granted");
  await expect.poll(() => page.evaluate(() => window.__geoCalls)).toBe(1);

  await page.keyboard.press("Shift");
  await expect.poll(async () => (await readGeolocationStore(page))?.status).toBe("granted");
  expect(await page.evaluate(() => window.__geoCalls)).toBe(2);
});
