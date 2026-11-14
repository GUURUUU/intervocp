import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

/**
 * Global setup: logs in every demo role once and stores the session
 * cookies so individual tests start authenticated instantly.
 */
const ACCOUNTS = [
  { key: "admin", email: "admin@intervocp.demo" },
  { key: "dispatcher", email: "dispatcher1@intervocp.demo" },
  { key: "technician", email: "tech1@intervocp.demo" },
  { key: "client", email: "client1@intervocp.demo" },
  { key: "manager", email: "manager@intervocp.demo" },
];

const PASSWORD = "Demo1234!";
const AUTH_DIR = path.join(__dirname, ".auth");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const account of ACCOUNTS) {
      const context = await browser.newContext({ locale: "fr-FR" });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`);
      await page.getByLabel("Email").fill(account.email);
      await page.getByLabel("Mot de passe").fill(PASSWORD);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await page.waitForURL("**/dashboard");
      await context.storageState({
        path: path.join(AUTH_DIR, `${account.key}.json`),
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
