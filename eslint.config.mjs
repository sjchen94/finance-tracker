import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // eslint-plugin-react-hooks v6 (React Compiler) ships several very strict
    // rules that flag correct, idiomatic patterns (async setState in effects,
    // refs read in render, nested components, Date.now in render, etc.).
    // Enforcing them across these existing apps would require a risky refactor
    // with little test coverage, so they are disabled here. rules-of-hooks
    // stays on; exhaustive-deps is kept as a non-failing warning.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/refs": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
