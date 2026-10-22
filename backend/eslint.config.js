const js = require("@eslint/js");
const react = require("eslint-plugin-react");

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

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  navigator: "readonly",
  location: "readonly",
  history: "readonly",
  performance: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  fetch: "readonly",
  alert: "readonly",
  confirm: "readonly",
  prompt: "readonly",
  HTMLElement: "readonly",
  Element: "readonly",
  Node: "readonly",
  Event: "readonly",
  CustomEvent: "readonly",
  FormData: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
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

  // React JSX rules.
{
  files: ["**/*.jsx"],

  plugins: {
    react,
  },

  rules: {
    ...react.configs.recommended.rules,
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
  },
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
        ...commonGlobals,
	...browserGlobals,
      },
    },

    rules: commonRules,
  },
];