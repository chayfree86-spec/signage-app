import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    "dist/**",
    "output/**",
    "build/**",
    "node_modules/**",
    "*.tsbuildinfo",
  ]),
]);

export default eslintConfig;
