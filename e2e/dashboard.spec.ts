import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

/** Dashboard: KPI cards, charts and utilization. */
test.describe("tableau de bord", () => {
  test("shows KPI cards and the four charts", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Demandes suivies")).toBeVisible();
    await expect(page.getByText("Résolution moyenne")).toBeVisible();
    await expect(page.getByText("Taux de retard")).toBeVisible();
    await expect(page.getByText("Satisfaction")).toBeVisible();

    await expect(page.locator("svg.recharts-surface")).toHaveCount(4);
    await expect(page.getByText("Répartition par statut")).toBeVisible();
    await expect(page.getByText("Volume mensuel")).toBeVisible();
    await expect(page.getByText("Charge des techniciens")).toBeVisible();
  });
});

/** Reports page: export button only for office roles (see reports.spec for others). */
test.describe("administration", () => {
  test("lists internal users with roles and stats", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "Administration" }).first()
    ).toBeVisible();
    await expect(page.getByText("Utilisateurs internes")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(9);
    await expect(page.getByText("admin@intervocp.demo")).toBeVisible();
  });
});
