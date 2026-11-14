import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

/** Stock board: catalogue, search and restock action. */
test.describe("stock", () => {
  test("lists catalogue parts with quantities and value", async ({ page }) => {
    await page.goto("/stock");

    await expect(
      page.getByRole("heading", { name: "Gestion des stocks" }).first()
    ).toBeVisible();
    await expect(page.getByText(/Valeur ≈/)).toBeVisible();
    await expect(page.locator("text=/PIECE-\\d+/").first()).toBeVisible();
  });

  test("filters the catalogue by search", async ({ page }) => {
    await page.goto("/stock");
    const search = page.getByPlaceholder(/Rechercher une pi.ce/);

    await search.fill("ampoule");
    await page.waitForTimeout(800);
    await expect(page.locator("text=/PIECE-\\d+/").first()).toBeVisible();
  });

  test("opens the restock dialog for a part", async ({ page }) => {
    await page.goto("/stock");

    const restock = page.getByRole("button", { name: /Réapprovisionner/ }).first();
    await restock.click();
    await expect(page.getByText("Réapprovisionner").first()).toBeVisible();
  });
});
