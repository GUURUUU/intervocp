import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

/** Requests browser + detail + PDF report. */
test.describe("demandes (admin)", () => {
  test("lists seeded requests", async ({ page }) => {
    await page.goto("/requests");

    await expect(page.locator("text=/INT-\\d{4}-\\d{4}/").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Nouvelle demande/ })).toBeVisible();
  });

  test("opens a detail page with status panel and PDF report", async ({ page }) => {
    await page.goto("/requests");
    // Click the first request card (title link).
    await page.locator("a[href*='/requests/']").first().click();
    await page.waitForURL(/\/requests\/[a-z0-9]+/i);

    await expect(page.locator("text=/INT-\\d{4}-\\d{4}/").first()).toBeVisible();
    // Button asChild renders an <a>, so it exposes role=link.
    await expect(page.getByRole("link", { name: /Rapport PDF/ })).toBeVisible();
  });

  test("the PDF report endpoint returns a valid PDF", async ({ page }) => {
    await page.goto("/requests");
    const detailUrl = await page
      .locator("a[href*='/requests/']")
      .first()
      .getAttribute("href");
    const id = detailUrl!.split("/").pop()!;

    const res = await page.request.get(`/api/requests/${id}/report`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    const body = await res.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("creates a new request through the dialog", async ({ page }) => {
    await page.goto("/requests");
    await page.getByRole("button", { name: /Nouvelle demande/ }).click();

    // Dialog title uses a typographic apostrophe (d’intervention).
    await expect(
      page.getByText(/Nouvelle demande d.intervention/)
    ).toBeVisible();
    await page.getByLabel("Titre").fill("Test E2E — capteur défaillant");
    await page
      .getByLabel("Description")
      .fill("Créé automatiquement par le test E2E Playwright.");
    await page.getByRole("button", { name: "Créer la demande" }).click();

    await expect(
      page.locator("text=Test E2E — capteur défaillant").first()
    ).toBeVisible();
  });
});
