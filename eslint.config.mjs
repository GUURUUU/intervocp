import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "docs/screenshots/**",
      // Installed agent skills (third-party bundled scripts)
      ".agents/**",
      "design-system/**",
      // Next.js generated file
      "next-env.d.ts",
      // Vendored third-party library (dashersw/liquid-glass-js)
      "src/lib/liquid-glass/glass-core.js",
      // Data seeding script (console logging is intentional there)
      "prisma/seed.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
];

export default eslintConfig;
