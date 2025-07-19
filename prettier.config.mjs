/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
	printWidth: 80,
	tabWidth: 4,
	useTabs: true,
	semi: true,
	singleQuote: false,
	trailingComma: "none",
	bracketSpacing: true,
	objectWrap: "collapse",
	bracketSameLine: false,
	arrowParens: "avoid",
	proseWrap: "always",
	endOfLine: "lf",
	experimentalTernaries: true
};

export default config;
