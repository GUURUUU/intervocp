import { expect, test } from "@playwright/test";

/** Each role lands on its own dashboard (same route, role-based view). */
test.describe("tableau de bord administrateur", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("shows the administration console", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { level: 1, name: /Console d.administration/ })
    ).toBeVisible();
    await expect(page.getByText("Comptes par rôle")).toBeVisible();
    await expect(page.getByText("Alertes de stock")).toBeVisible();
    await expect(page.getByText("Activité récente")).toBeVisible();
  });
});

test.describe("tableau de bord répartiteur", () => {
  test.use({ storageState: "e2e/.auth/dispatcher.json" });

  test("shows the dispatch queue and technician load", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { level: 1, name: "Poste de répartition" })
    ).toBeVisible();
    await expect(page.getByText("File d'affectation")).toBeVisible();
    await expect(page.getByText("Charge des techniciens")).toBeVisible();
  });
});

test.describe("tableau de bord technicien", () => {
  test.use({ storageState: "e2e/.auth/technician.json" });

  test("shows the technician's own day and skills", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { level: 1, name: "Ma journée" })).toBeVisible();
    await expect(page.getByText("Ma file")).toBeVisible();
    await expect(page.getByText("Mes compétences")).toBeVisible();
  });
});

test.describe("tableau de bord client", () => {
  test.use({ storageState: "e2e/.auth/client.json" });

  test("shows the client's own requests without internal navigation", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { level: 1, name: "Mes demandes" })).toBeVisible();
    await expect(page.getByText("Suivi de mes demandes")).toBeVisible();
    await expect(page.getByText("Mes équipements")).toBeVisible();
    await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
  });
});

test.describe("tableau de bord responsable", () => {
  test.use({ storageState: "e2e/.auth/manager.json" });

  test("shows service performance with the four charts", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { level: 1, name: "Pilotage du service" })
    ).toBeVisible();
    await expect(page.getByText("Performance de l'équipe")).toBeVisible();
    await expect(page.getByText("Backlog > 7 j")).toBeVisible();

    await expect(page.getByText("Demandes suivies")).toBeVisible();
    await expect(page.locator("svg.recharts-surface")).toHaveCount(4);
    await expect(page.getByText("Répartition par statut")).toBeVisible();
  });
});

/** Réservé aux rôles internes : un client est renvoyé sur son tableau de bord. */
test.describe("contrôle d'accès", () => {
  test.use({ storageState: "e2e/.auth/client.json" });

  test("a client cannot open the administration page", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { level: 1, name: "Mes demandes" })).toBeVisible();
  });
});

/** Administration page: users, roles and stats. */
test.describe("administration", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

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
