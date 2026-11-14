import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

/** Planning board: week grid navigation. */
test.describe("planification", () => {
  test("shows the week grid for the current week", async ({ page }) => {
    await page.goto("/planning");

    await expect(
      page.getByRole("heading", { name: /Planification & affectation/ }).first()
    ).toBeVisible();
    await expect(page.getByText(/Semaine du/)).toBeVisible();
  });

  test("navigates between weeks", async ({ page }) => {
    await page.goto("/planning");

    const label = page.getByText(/Semaine du/);
    const before = await label.innerText();
    await page.getByRole("button", { name: "Semaine suivante" }).click();
    await expect(label).not.toHaveText(before);
  });
});
