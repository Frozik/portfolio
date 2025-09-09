/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 4,
  overrides: [
    {
      files: ['*.json', '*.config.js'],
      options: {
        tabWidth: 2,
      },
    },
  ],
};

export default config;
