import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		plugins: { js },
		extends: ["js/recommended"]
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		languageOptions: { globals: globals.browser }
	},
	globalIgnores(["src-tauri"]),
	tseslint.configs.recommended,
	{
		rules: {
			"consistent-return": 2,
			indent: [1, 4],
			"no-else-return": 1,
			semi: [1, "always"],
			"space-unary-ops": 2
		}
	},
	eslintConfigPrettier
]);
