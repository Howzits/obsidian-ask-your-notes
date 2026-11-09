import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

// Enforce the UI rules that blocked community-directory publication.
// Behavioral findings (note enumeration, clipboard, streaming fetch) are
// reviewed separately; they are intentional capabilities, not hidden here.
export default [
  {
    files: ["main.ts", "src/**/*.ts"],
    ignores: ["src/**/*.d.ts"],
    languageOptions: { parser: tseslint.parser },
    plugins: { obsidianmd },
    rules: {
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/settings-tab/prefer-setting-definitions": "error",
      "obsidianmd/settings-tab/prefer-update-over-display": "error",
      "obsidianmd/settings-tab/no-deprecated-display": "error",
    },
  },
];
