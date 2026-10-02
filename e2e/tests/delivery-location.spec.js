import { expect, test } from "@playwright/test";
import { DRIVER_PHONE, DRIVER_PIN, updateOrderStatus } from "./helpers.js";

// Point exact de livraison sans carte : permission de localisation demandee
// des l arrivee, puis deux options au checkout (lien Google Maps colle /
// position exacte). Pour chaque commande on verifie ce que recoit le livreur,
// par ordre de priorite : 1. lien du client, 2. position exacte, 3. adresse
// + commune en dernier recours.

const HYDRA = { latitude: 36.7503, longitude: 3.0441 };
const GEO_KEY = "galatee.geolocation";
const FULL_LINK = "https://www.google.com/maps/place/Hydra/@36.748,3.035,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d36.7512!4d3.0398!16s";
const SHORT_LINK = "https://maps.app.goo.gl/AbCdEf123456";

function exactNavigationHref(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

async function readGeolocationStore(page) {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null"), GEO_KEY);
}

// Meme parcours que order-client.spec.js : plat preselectionne via ?dish=.
async function goToCheckout(page, firstName) {
  await page.goto("/commande?dish=spaghetti-pomodoro");
  await expect(page.getByRole("heading", { name: /Ta sélection/i })).toBeVisible();
  await page.getByRole("button", { name: /Confirmer ma sélection/i }).click();
  await expect(page.getByRole("heading", { name: /Tes coordonnées/i })).toBeVisible();

  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill(firstName);
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Localisation");
  await page.getByLabel("Téléphone").fill("+213555111222");
  await page.getByRole("combobox").selectOption("hydra");
  await page.getByLabel("Adresse de livraison").fill(`Adresse ${firstName}, Hydra`);
  // Plus de carte Leaflet sur la page.
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
}

async function pasteLink(page, link) {
  await page.getByRole("textbox", { name: /Coller un lien Google Maps/i }).fill(link);
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
// renvoie le lien de navigation affiche sur sa carte.
async function driverNavigation(page, request, order) {
  await updateOrderStatus(request, order.id, "confirmed");

  // Chaque test a un contexte neuf : le livreur n est jamais deja connecte.
  await page.goto("/livreur/login");
  await page.getByLabel("Téléphone").fill(DRIVER_PHONE);
  await page.getByLabel("Code PIN").fill(DRIVER_PIN);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Tableau de bord", { exact: true })).toBeVisible();

  const customer = `${order.firstName} ${order.lastName}`;
  const poolCard = page.locator("article.pbg-drv-card-pool").filter({ hasText: customer });
  await expect(poolCard).toBeVisible({ timeout: 15_000 });
  await poolCard.getByRole("button", { name: /Prendre cette course/i }).click();

  const mineCard = page.locator("article.pbg-drv-card-mine").filter({ hasText: customer });
  await expect(mineCard).toBeVisible();
  const navLink = mineCard.locator("a[data-location-source]");
  return {
    href: await navLink.getAttribute("href"),
    source: await navLink.getAttribute("data-location-source"),
    label: (await navLink.innerText()).trim(),
  };
}

test.describe("permission de localisation accordee", () => {
  test.use({ permissions: ["geolocation"], geolocation: HYDRA });

  test("la position est obtenue des l arrivee sur le site, avant le checkout", async ({ page }) => {
    await page.goto("/");
    await expect.poll(async () => (await readGeolocationStore(page))?.status).toBe("granted");
    const stored = await readGeolocationStore(page);
    expect(stored.position).toMatchObject(HYDRA);
  });

  test("position exacte seule : le livreur navigue vers la position, pas l adresse", async ({ page, request }) => {
    await goToCheckout(page, "Position");
    await page.getByRole("button", { name: /Utiliser ma position exacte/i }).click();
    await expect(page.getByText(/Votre position exacte/)).toBeVisible();

    const order = await submitOrder(page);
    expect(order.deliveryLatitude).toBe(HYDRA.latitude);
    expect(order.deliveryLongitude).toBe(HYDRA.longitude);
    expect(order.deliveryMapsUrl).toBeNull();

    const nav = await driverNavigation(page, request, order);
    expect(nav.source).toBe("position");
    expect(nav.href).toBe(exactNavigationHref(HYDRA.latitude, HYDRA.longitude));
    expect(nav.label).toContain("Position exacte du client");
  });

  test("lien et position fournis : le livreur ouvre le lien en priorite", async ({ page, request }) => {
    await goToCheckout(page, "Lienposition");
    await page.getByRole("button", { name: /Utiliser ma position exacte/i }).click();
    await pasteLink(page, SHORT_LINK);
    await page.getByRole("button", { name: /Utiliser ce lien/i }).click();
    await expect(page.getByText(/\(ouvert en priorité\)/)).toBeVisible();
    await expect(page.getByText(/\(en secours\)/)).toBeVisible();

    const order = await submitOrder(page);
    expect(order.deliveryMapsUrl).toBe(SHORT_LINK);
    expect(order.deliveryLatitude).toBe(HYDRA.latitude);

    const nav = await driverNavigation(page, request, order);
    expect(nav.source).toBe("link");
    expect(nav.href).toBe(SHORT_LINK);
  });

  test("le bouton prend une position fraiche, pas celle obtenue a l arrivee", async ({ page, context }) => {
    await goToCheckout(page, "Fraiche");
    // La position de l arrivee sur la page est deja en memoire...
    await expect.poll(async () => (await readGeolocationStore(page))?.position?.latitude).toBe(HYDRA.latitude);

    // ...puis le client se deplace (ou le GPS se cale) avant de cliquer.
    const entrance = { latitude: 36.7488, longitude: 3.0512 };
    await context.setGeolocation({ ...entrance, accuracy: 8 });
    await page.getByRole("button", { name: /Utiliser ma position exacte/i }).click();
    await expect(page.getByText(/Votre position exacte/)).toBeVisible();

    const order = await submitOrder(page);
    expect(order.deliveryLatitude).toBe(entrance.latitude);
    expect(order.deliveryLongitude).toBe(entrance.longitude);
  });
});

test.describe("position imprecise (ordinateur sans GPS)", () => {
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 36.756, longitude: 2.971, accuracy: 2500 } });

  test("une estimation a plusieurs km est refusee et n est pas envoyee", async ({ page }) => {
    await goToCheckout(page, "Imprecise");
    await page.getByRole("button", { name: /Utiliser ma position exacte/i }).click();
    await expect(page.getByText(/Position trop imprécise \(± 2,5 km\)/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Aucun point enregistré/)).toBeVisible();

    const order = await submitOrder(page);
    expect(order.deliveryLatitude).toBeNull();
    expect(order.deliveryLongitude).toBeNull();
  });
});

test("lien Google Maps complet : point detecte, confirme, ouvert tel quel par le livreur", async ({ page, request }) => {
  await goToCheckout(page, "Lien");
  await pasteLink(page, FULL_LINK);

  // Le point detecte est montre au client mais rien n est enregistre avant confirmation.
  await expect(page.getByText("36.75120° N, 3.03980° E")).toBeVisible();
  await expect(page.getByText(/Aucun point enregistré/)).toBeVisible();
  await page.getByRole("button", { name: /Utiliser ce lien/i }).click();
  await expect(page.getByText(/Votre lien Google Maps/)).toBeVisible();

  const order = await submitOrder(page);
  expect(order.deliveryMapsUrl).toBe(FULL_LINK);
  expect(order.deliveryLatitude).toBeNull();

  const nav = await driverNavigation(page, request, order);
  expect(nav.source).toBe("link");
  expect(nav.href).toBe(FULL_LINK);
  expect(nav.label).toContain("Lien Google Maps du client");
});

test("lien court maps.app.goo.gl : accepte apres verification, transmis au livreur", async ({ page, request }) => {
  await goToCheckout(page, "Court");
  await pasteLink(page, SHORT_LINK);
  await expect(page.getByText(/Lien court Google Maps reconnu/)).toBeVisible();
  await page.getByRole("button", { name: /Utiliser ce lien/i }).click();

  const order = await submitOrder(page);
  expect(order.deliveryMapsUrl).toBe(SHORT_LINK);

  const nav = await driverNavigation(page, request, order);
  expect(nav.source).toBe("link");
  expect(nav.href).toBe(SHORT_LINK);
});

test("lien non Google Maps : refuse avec un message, rien n est envoye", async ({ page }) => {
  await goToCheckout(page, "Invalide");
  await pasteLink(page, "https://evil.example/maps/@36.75,3.04,17z");
  await expect(page.getByText(/Lien non reconnu/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Utiliser ce lien/i })).toHaveCount(0);
  await expect(page.getByText(/Aucun point enregistré/)).toBeVisible();
});

test("permission refusee et pas de lien : adresse et commune en dernier recours", async ({ page, request }) => {
  await page.goto("/");
  await expect.poll(async () => (await readGeolocationStore(page))?.status).toBe("denied");

  await goToCheckout(page, "Refus");
  await page.getByRole("button", { name: /Utiliser ma position exacte/i }).click();
  await expect(page.getByText(/Localisation refusée\. Autorisez-la/)).toBeVisible();
  await expect(page.getByText(/Aucun point enregistré/)).toBeVisible();

  const order = await submitOrder(page);
  expect(order.deliveryMapsUrl).toBeNull();
  expect(order.deliveryLatitude).toBeNull();

  const nav = await driverNavigation(page, request, order);
  expect(nav.source).toBe("address");
  expect(nav.href).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Adresse%20Refus/);
  expect(nav.label).toContain("Adresse Refus, Hydra");
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
