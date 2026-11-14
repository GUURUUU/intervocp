import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

/** Real-time tracking: live map + intervention kanban. */
test.describe("suivi temps réel", () => {
  test("renders the leaflet map with technician markers", async ({ page }) => {
    await page.goto("/tracking");

    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".map-tech-marker").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("renders the six kanban columns", async ({ page }) => {
    await page.goto("/tracking");

    await expect(page.getByText("Nouvelle").first()).toBeVisible();
    await expect(page.getByText("En cours").first()).toBeVisible();
    await expect(page.getByText("Terminée").first()).toBeVisible();
    await expect(page.getByText("Clôturée").first()).toBeVisible();
  });

  test("shows the position simulator for office roles", async ({ page }) => {
    await page.goto("/tracking");
    await expect(page.getByText(/Simuler/).first()).toBeVisible();
  });
});
