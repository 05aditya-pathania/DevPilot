const js = require("@eslint/js");

const commonRules = {
  ...js.configs.recommended.rules,

  "no-unused-vars": [
    "warn",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    },
  ],

  "no-console": "off",
  "no-debugger": "warn",
  "no-eval": "warn",
};

const commonGlobals = {
  console: "readonly",
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  module: "readonly",
  require: "readonly",
  exports: "readonly",
  global: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "uploads/**",
      "dist/**",
      "build/**",
      "coverage/**",
      ".next/**",
    ],
  },

  // CommonJS JavaScript files.
  {
    files: ["**/*.js", "**/*.cjs"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: commonGlobals,
    },

    rules: commonRules,
  },

  // ES modules and JSX files.
  {
    files: ["**/*.mjs", "**/*.jsx"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },

      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },

    rules: commonRules,
  },
];