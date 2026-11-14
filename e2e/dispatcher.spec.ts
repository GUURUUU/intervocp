import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/dispatcher.json" });

/** Dispatcher workflows: suggestion ranking + assignment + planning. */
test.describe("répartiteur", () => {
  test("ranks technicians in the suggestion dialog", async ({ page }) => {
    await page.goto("/requests");
    await page.locator("a[href*='/requests/']").first().click();
    await page.waitForURL(/\/requests\/[a-z0-9]+/i);

    await page.getByRole("button", { name: /Affecter \/ suggérer/ }).click();
    await expect(
      page.getByText("Suggestion de technicien")
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Compétences").first()).toBeVisible();
    await expect(page.getByText("Disponibilité").first()).toBeVisible();
  });

  test("sees the planning week grid", async ({ page }) => {
    await page.goto("/planning");
    await expect(
      page.getByRole("heading", { name: /Planification/ }).first()
    ).toBeVisible();
  });
});
