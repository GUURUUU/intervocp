import { expect, test } from "@playwright/test";

/** Login flow: failure then success. */
test.describe("authentification", () => {
  test("refuses wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("intrus@intervocp.demo");
    await page.getByLabel("Mot de passe").fill("Mauvais1234!");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.locator("p[role='alert']")).toContainText(/incorrect/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in as admin and reaches the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@intervocp.demo");
    await page.getByLabel("Mot de passe").fill("Demo1234!");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByText("Bonjour Nadia Benali")).toBeVisible();
  });

  test("redirects anonymous users to /login", async ({ page }) => {
    await page.goto("/requests");
    await expect(page).toHaveURL(/\/login/);
  });
});
