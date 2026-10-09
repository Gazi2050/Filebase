import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored editorcn source — owned code, but lint rules for our app
    // shouldn't gate stock template internals.
    "components/editor/**",
    "components/extensions/**",
    "components/block-editor/**",
  ]),
]);

export default eslintConfig;
