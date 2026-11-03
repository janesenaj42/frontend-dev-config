// The CLI is linted with this repository's own rules, minus the React parts: it runs on Node.
import js from "@eslint/js";
import {
  ignores,
  orgRules,
  prettier,
  reviewRules,
  sonar,
  tests,
} from "@janesenaj42/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  ignores,
  // Sample projects the tests copy; each has its own ESLint config.
  globalIgnores(["test/fixtures"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  sonar,
  orgRules,
  reviewRules,
  tests,
  prettier,
]);
