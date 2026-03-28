import js from "@eslint/js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

import reactHooks from "eslint-plugin-react-hooks";

import reactRefresh from "eslint-plugin-react-refresh";

const rootDir = dirname(fileURLToPath(import.meta.url));

const linebreakRule = "off";

export default [
  {
    ignores: [
      "dist",
      ".codex_tmp/**",
      "vite.config.js.timestamp-*",
      "*.timestamp-*.mjs",
    ],
  },

  {
    files: ["**/*.{js,jsx}"],

    languageOptions: {
      ecmaVersion: 2020,

      globals: {
        ...globals.browser,

        ...globals.node,
      },

      parserOptions: {
        ecmaVersion: "latest",

        ecmaFeatures: { jsx: true },

        sourceType: "module",
      },
    },

    plugins: {
      "react-hooks": reactHooks,

      "react-refresh": reactRefresh,
    },

    rules: {
      ...js.configs.recommended.rules,

      ...reactHooks.configs.recommended.rules,

      "no-unused-vars": ["warn", { varsIgnorePattern: "^[A-Z_]" }],

      "linebreak-style": linebreakRule,

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  {
    files: ["eslint.config.js"],

    rules: {
      "linebreak-style": "off",
    },
  },

  {
    files: ["server-v4/src/**/*.ts"],

    ignores: ["server-v4/src/**/*.d.ts"],

    languageOptions: {
      parser: tsParser,

      ecmaVersion: "latest",

      sourceType: "module",

      globals: {
        ...globals.node,
      },

      parserOptions: {
        project: "./tsconfig.server-v4.json",

        tsconfigRootDir: rootDir,
      },
    },

    plugins: {
      "@typescript-eslint": tsPlugin,
    },

    rules: {
      ...js.configs.recommended.rules,

      ...tsPlugin.configs.recommended.rules,

      "linebreak-style": "off",

      "no-undef": "off",

      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^[A-Z_]" },
      ],
    },
  },
];
