/**
 * Generates per-role screenshots of the app into docs/screenshots/.
 * Run with the dev server up:  npx tsx docs/scripts/screenshots.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const PASSWORD = "Demo1234!";
const OUT_DIR = path.join(__dirname, "..", "screenshots");

const ACCOUNTS = {
  admin: "admin@intervocp.demo",
  dispatcher: "dispatcher1@intervocp.demo",
  technician: "tech1@intervocp.demo",
  client: "client1@intervocp.demo",
  manager: "manager@intervocp.demo",
} as const;

async function loginAs(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  email: string
) {
  const context = await browser.newContext({
    locale: "fr-FR",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/dashboard");
  return { context, page };
}

async function shoot(page: import("@playwright/test").Page, name: string) {
  const target = path.join(OUT_DIR, `${name}.png`);
  await page.waitForTimeout(1800); // let charts / shaders settle
  await page.screenshot({ path: target, fullPage: false });
  console.info(`✓ ${target}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  try {
    // Anonymous: the login page with shader background.
    {
      const context = await browser.newContext({
        locale: "fr-FR",
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`);
      await shoot(page, "login");
      await context.close();
    }

    // ADMIN: every module.
    {
      const { context, page } = await loginAs(browser, ACCOUNTS.admin);
      await shoot(page, "admin-dashboard");
      await page.goto(`${BASE_URL}/requests`);
      await shoot(page, "admin-requests");
      await page.goto(`${BASE_URL}/planning`);
      await shoot(page, "admin-planning");
      await page.goto(`${BASE_URL}/tracking`);
      await shoot(page, "admin-tracking");
      await page.goto(`${BASE_URL}/stock`);
      await shoot(page, "admin-stock");
      await page.goto(`${BASE_URL}/reports`);
      await shoot(page, "admin-reports");
      await page.goto(`${BASE_URL}/admin`);
      await shoot(page, "admin-administration");
      await context.close();
    }

    // DISPATCHER: role dashboard, then requests + suggestion dialog open.
    {
      const { context, page } = await loginAs(browser, ACCOUNTS.dispatcher);
      await shoot(page, "dispatcher-dashboard");
      // Pick a request through the API so the shot does not depend on the
      // list finishing its client-side fetch.
      const listResponse = await page.request.get(
        `${BASE_URL}/api/requests?page=1&pageSize=1`
      );
      const list = (await listResponse.json()) as { items: { id: string }[] };
      await page.goto(`${BASE_URL}/requests/${list.items[0].id}`);
      await page.waitForURL(/\/requests\/[a-z0-9]+/i);
      await page.getByRole("button", { name: /Affecter \/ suggérer/ }).click();
      await page.getByText("Suggestion de technicien").waitFor();
      await shoot(page, "dispatcher-suggestion");
      await context.close();
    }

    // TECHNICIAN: scoped dashboard + kanban.
    {
      const { context, page } = await loginAs(browser, ACCOUNTS.technician);
      await shoot(page, "technician-dashboard");
      await page.goto(`${BASE_URL}/tracking`);
      await shoot(page, "technician-kanban");
      await context.close();
    }

    // CLIENT: scoped dashboard.
    {
      const { context, page } = await loginAs(browser, ACCOUNTS.client);
      await shoot(page, "client-dashboard");
      await context.close();
    }

    // MANAGER: role dashboard + reports.
    {
      const { context, page } = await loginAs(browser, ACCOUNTS.manager);
      await shoot(page, "manager-dashboard");
      await page.goto(`${BASE_URL}/reports`);
      await shoot(page, "manager-reports");
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
