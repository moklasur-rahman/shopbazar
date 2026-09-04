import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**", "backend/**"] },
  js.configs.recommended,

  // ---------------------------------------------------------- JS / JSX
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // ---------------------------------------------------------- TS / TSX
  // এখনো কোনো .ts ফাইল নেই, কিন্তু ভিত্তিটা বসানো আছে — নতুন ফাইল
  // .tsx হিসেবে লিখলেই লিন্ট আর টাইপ চেক দুটোই সাথে সাথে কাজ করবে।
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // TS-এ ব্যবহার-না-হওয়া ভেরিয়েবল ধরার কাজটা typescript-eslint ভালো
      // করে (টাইপ-অনলি ইমপোর্ট বোঝে), তাই মূল নিয়মটা বন্ধ
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // ------------------------------------------------------------ টেস্ট
  {
    files: ["**/*.test.{js,jsx,ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
];
