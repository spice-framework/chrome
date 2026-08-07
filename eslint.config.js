"use strict";

module.exports = [
  {
    ignores: ["build/**", "artifacts/**", "node_modules/**"],
  },
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        addEventListener: "readonly",
        chrome: "readonly",
        document: "readonly",
        FormData: "readonly",
        getComputedStyle: "readonly",
        globalThis: "readonly",
        location: "readonly",
        module: "readonly",
        MutationObserver: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "tests/**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
