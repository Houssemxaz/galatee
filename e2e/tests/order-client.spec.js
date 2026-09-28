import { expect, test } from "@playwright/test";

// Parcours client complet : ouvrir /commande, ajouter un plat, aller a
// /commande/coordonnees, remplir le formulaire, envoyer, verifier l ecran
// de confirmation.
test("client peut composer et envoyer une commande delivery", async ({ page }) => {
  await test.step("ouvre la page commande", async () => {
    await page.goto("/commande");
  });

  await test.step("ajoute le plat E2E au panier", async () => {
    // Le plat seede est "Spaghetti Pomodoro E2E". Il apparait sous "+ Ajouter
    // a la commande" ; on cible la chip par son texte visible (nav "Commander"
    // dans le header partage aussi le mot, d ou le filtre `.first()`).
    const addChip = page.getByRole("button", { name: /Spaghetti Pomodoro E2E/i }).first();
    await expect(addChip).toBeVisible({ timeout: 15_000 });
    await addChip.click();
    // Le panier doit maintenant contenir 1 article + les controls +/-.
    await expect(page.getByRole("group", { name: /Quantité/i })).toBeVisible();
  });

  await test.step("passe a l etape coordonnees", async () => {
    await page.getByRole("button", { name: /Confirmer ma sélection/i }).click();
    await expect(page).toHaveURL(/\/commande\/coordonnees$/);
  });

  await test.step("remplit et envoie le formulaire", async () => {
    await page.getByRole("textbox", { name: "Prénom", exact: true }).fill("Lina");
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Test");
    await page.getByRole("textbox", { name: /Téléphone/i }).fill("+213555111000");
    // Selectionne Hydra (id "hydra" seede par orderSystem.DEFAULT_COMMUNES).
    const communeSelect = page.getByRole("combobox", { name: /Commune/i });
    await communeSelect.selectOption("hydra");
    await page.getByRole("textbox", { name: /Adresse de livraison/i }).fill("12 rue des Oliviers, Hydra");

    const submitPromise = page.waitForResponse(
      (r) => r.url().includes("/api/orders") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Envoyer ma commande/i }).click();
    const submitResponse = await submitPromise;
    expect(submitResponse.status()).toBe(201);
    const payload = await submitResponse.json();
    expect(payload.order.status).toBe("pending");
    expect(payload.order.firstName).toBe("Lina");
  });

  await test.step("verifie l ecran de confirmation", async () => {
    await expect(page.getByText(/Commande reçue/i)).toBeVisible();
  });
});
