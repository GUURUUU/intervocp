import { expect, test } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test.use({ storageState: "e2e/.auth/admin.json" });

/** Reports: KPIs, CSV export and role-gated export button. */
test.describe("rapports", () => {
  test("shows KPI cards and charts", async ({ page }) => {
    await page.goto("/reports");

    await expect(
      page.getByRole("heading", { name: /Rapports & indicateurs/ })
    ).toBeVisible();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible();
  });

  test("exports the interventions CSV with a BOM and rows", async ({
    page,
  }, testInfo) => {
    await page.goto("/reports");
    await expect(page.getByRole("link", { name: /Exporter en CSV/ })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: /Exporter en CSV/ }).click(),
    ]);

    const target = path.join(os.tmpdir(), `csv-${testInfo.testId}.csv`);
    await download.saveAs(target);

    const content = fs.readFileSync(target, "utf8");
    expect(content.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM for Excel
    expect(content).toContain("Référence;Titre");
    expect(content.split("\r\n").length).toBeGreaterThan(10);
  });
});

test.describe("rapports (client)", () => {
  test.use({ storageState: "e2e/.auth/client.json" });

  test("shows scoped KPIs without the CSV export", async ({ page }) => {
    await page.goto("/reports");

    await expect(page.getByText("Demandes suivies")).toBeVisible();
    await expect(page.getByRole("link", { name: /Exporter en CSV/ })).toHaveCount(0);
  });
});
