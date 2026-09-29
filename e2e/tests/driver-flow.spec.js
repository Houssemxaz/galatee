import { test, expect } from "@playwright/test";
import {
  DRIVER_PHONE,
  DRIVER_PIN,
  createConfirmedOrder,
  getDish,
  updateOrderStatus,
} from "./helpers.js";

async function loginDriver(page) {
  await page.goto("/livreur/login");
  await page.getByLabel("Téléphone").fill(DRIVER_PHONE);
  await page.getByLabel("Code PIN").fill(DRIVER_PIN);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Tableau de bord", { exact: true })).toBeVisible();
}

test("un livreur prend, démarre et livre une course", async ({ page, request }) => {
  const dish = await getDish(request);
  const order = await createConfirmedOrder(request, dish.id);

  await loginDriver(page);
  const poolCard = page.locator("article.pbg-drv-card-pool").filter({ hasText: order.firstName });
  await expect(poolCard).toBeVisible();
  await poolCard.getByRole("button", { name: /Prendre cette course/i }).click();
  await expect(page.locator("article.pbg-drv-card-mine").filter({ hasText: order.firstName })).toBeVisible();

  await updateOrderStatus(request, order.id, "ready");
  await page.reload();
  const activeCard = page.locator("article.pbg-drv-card-mine").filter({ hasText: order.firstName });
  await expect(activeCard.getByRole("button", { name: /Je pars livrer/i })).toBeVisible();
  await activeCard.getByRole("button", { name: /Je pars livrer/i }).click();
  await activeCard.getByRole("button", { name: "Livrée" }).click();
  await expect(page.getByRole("heading", { name: /Livrée et encaissée/i })).toBeVisible();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.locator("article.pbg-drv-card-mine").filter({ hasText: order.firstName })).toHaveCount(0);
});

test("un livreur peut annuler une livraison après son départ", async ({ page, request }) => {
  const dish = await getDish(request);
  const order = await createConfirmedOrder(request, dish.id);

  await loginDriver(page);
  const poolCard = page.locator("article.pbg-drv-card-pool").filter({ hasText: order.firstName });
  await poolCard.getByRole("button", { name: /Prendre cette course/i }).click();
  await updateOrderStatus(request, order.id, "ready");
  await page.reload();

  const activeCard = page.locator("article.pbg-drv-card-mine").filter({ hasText: order.firstName });
  await activeCard.getByRole("button", { name: /Je pars livrer/i }).click();
  await activeCard.getByRole("button", { name: "Annulée" }).click();
  await expect(page.getByRole("heading", { name: "Livraison annulée" })).toBeVisible();
  await expect(page.getByText("Client injoignable", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmer l'annulation" }).click();
  await expect(page.locator("article.pbg-drv-card-mine").filter({ hasText: order.firstName })).toHaveCount(0);
});
