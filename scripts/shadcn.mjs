/**
 * Dev helper: runs the shadcn CLI with a sanitized environment.
 *
 * npm 12 rejects CLI/env-layer `allow-scripts` policies in project-scoped
 * installs (EALLOWSCRIPTS). The user's global .npmrc sets `allow-scripts`,
 * which npm exports as npm_config_allow_scripts to every child process —
 * so any npm install spawned by the shadcn CLI would fail. This wrapper
 * strips that variable before invoking the CLI directly with node.
 *
 * Usage: node scripts/shadcn.mjs add button
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "..", "node_modules", "shadcn", "dist", "index.js");

const env = { ...process.env };
delete env.npm_config_allow_scripts;
delete env.NPM_CONFIG_ALLOW_SCRIPTS;

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  shell: false,
});

process.exit(result.status ?? 1);
