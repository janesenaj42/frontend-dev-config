// The org's ESLint rules for ESLint 8 (.eslintrc), for projects not yet on flat config.
// A project uses it with `"extends": ["@janesenaj42/eslint-config-legacy"]` in its
// .eslintrc.json, then adds, changes or turns off rules in its own "rules".

// ESLint 8 loads plugins from the project, not from this package. This patch makes it load
// them from here, so a project installs this one package instead of every plugin below.
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    // Every tsconfig at the project root: Vite splits its config into tsconfig.app.json and
    // tsconfig.node.json, and some projects lint with a tsconfig.eslint.json.
    project: ["./tsconfig.json", "./tsconfig.*.json"],
  },
  plugins: ["sonarjs", "@typescript-eslint"],
  ignorePatterns: ["dist/", "build/", "coverage/"],
  extends: [
    "airbnb",
    "airbnb-typescript",
    "airbnb/hooks",
    "prettier",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    // React 17+ needs no `import React` for JSX.
    "plugin:react/jsx-runtime",
    "plugin:sonarjs/recommended",
  ],
  reportUnusedDisableDirectives: true,
  rules: {
    // SWQAT rules
    complexity: ["warn", 20],
    "func-names": ["warn", "as-needed"],
    "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
    "object-shorthand": ["error", "never"],
    // Webcore rules: MongoDB's _id
    "no-underscore-dangle": ["error", { allow: ["_id"] }],
  },
};
