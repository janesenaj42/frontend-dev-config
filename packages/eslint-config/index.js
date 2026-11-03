// The org's ESLint rules for TypeScript React projects, for ESLint 9 and 10 (flat config).
//
// A project spreads the default export into its eslint.config.js, then adds, changes or turns
// off rules after it. To leave out a whole part, list the named parts it wants instead.
import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import sonarjs from "eslint-plugin-sonarjs";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const SOURCE = ["**/*.{ts,tsx}"];
const TESTS = ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"];

const MAX_FUNCTION_LINES = 30;
const MAX_COMPLEXITY = 20;

export const ignores = globalIgnores(["dist", "build", "coverage"]);

/** ESLint's, typescript-eslint's and React's recommended rules. */
export const recommended = defineConfig({
  files: SOURCE,
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: { globals: globals.browser },
});

/** SonarJS's recommended rules (bugs and code smells). */
export const sonar = defineConfig({
  files: SOURCE,
  extends: [sonarjs.configs.recommended],
});

/** The org's own rules: SWQAT, and Webcore's MongoDB `_id`. */
export const orgRules = defineConfig({
  files: SOURCE,
  rules: {
    complexity: ["warn", MAX_COMPLEXITY],
    "func-names": ["warn", "as-needed"],
    "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
    // The org's file says "never"; the flat config uses the short form, as Prettier and most
    // TypeScript code do. eslint-config-legacy keeps "never".
    "object-shorthand": ["error", "always"],
    "no-underscore-dangle": ["error", { allow: ["_id"] }],
  },
});

/** The code review standards a linter can check (the baseline's CLAUDE.md). */
export const reviewRules = defineConfig({
  files: SOURCE,
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "max-lines-per-function": [
      "error",
      { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true },
    ],
    "no-magic-numbers": "off",
    "@typescript-eslint/no-magic-numbers": [
      "error",
      {
        ignore: [-1, 0, 1],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        ignoreEnums: true,
        ignoreNumericLiteralTypes: true,
        ignoreReadonlyClassProperties: true,
        ignoreTypeIndexes: true,
      },
    ],
  },
});

/** Tests describe cases with literal values and long tables. */
export const tests = defineConfig({
  files: TESTS,
  rules: {
    "@typescript-eslint/no-magic-numbers": "off",
    "max-lines-per-function": "off",
  },
});

/** Turns off every rule that would fight Prettier; must come after the parts above. */
export const prettier = prettierConfig;

export default defineConfig([
  ignores,
  recommended,
  sonar,
  orgRules,
  reviewRules,
  tests,
  prettier,
]);
