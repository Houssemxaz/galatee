import { test, expect } from "@playwright/test";

test("un client peut sélectionner un plat et envoyer une commande", async ({ page }) => {
  await page.goto("/commande?dish=spaghetti-pomodoro");

  await expect(page.getByRole("heading", { name: /Ta sélection/i })).toBeVisible();
  await expect(page.getByText("Spaghetti Pomodoro", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Confirmer ma sélection/i }).click();

  await expect(page.getByRole("heading", { name: /Tes coordonnées/i })).toBeVisible();
  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill("Lina");
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Martin");
  await page.getByLabel("Téléphone").fill("+213555123456");
  await page.getByRole("combobox").selectOption("hydra");
  await page.getByLabel("Adresse de livraison").fill("12 rue des Oliviers, Hydra");

  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/orders") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Envoyer ma commande/i }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  await expect(page.getByText(/Commande reçue/)).toBeVisible();
});
