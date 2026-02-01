import { typecheckedConfigs } from "@veraswap/eslint-config"
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...typecheckedConfigs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
