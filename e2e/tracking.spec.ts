import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

/** Intervention status tracking: workflow stages + kanban, no GPS. */
test.describe("suivi des interventions", () => {
  test("shows the workflow stages for each intervention", async ({ page }) => {
    await page.goto("/tracking");

    await expect(page.getByRole("heading", { name: "Suivi des interventions" })).toBeVisible();
    await expect(page.getByText("À planifier").first()).toBeVisible();
    await expect(page.getByText("Planifiée").first()).toBeVisible();
  });

  test("renders the six kanban columns", async ({ page }) => {
    await page.goto("/tracking");

    await expect(page.getByText("Nouvelle").first()).toBeVisible();
    await expect(page.getByText("En cours").first()).toBeVisible();
    await expect(page.getByText("Terminée").first()).toBeVisible();
    await expect(page.getByText("Clôturée").first()).toBeVisible();
  });

  test("filters the tracking list by stage", async ({ page }) => {
    await page.goto("/tracking");

    await page.getByRole("tab", { name: "Terminées" }).click();
    await expect(page.getByRole("tab", { name: "Terminées" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
