/** jest-expo runs the screens; workspace libraries ship TypeScript and ESM, so they are transformed too. */
module.exports = {
  preset: 'jest-expo/android',
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 30_000,
  // The package's `react-native` entry is `.mjs`, which jest-expo does not transform.
  moduleNameMapper: {
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm|((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|standard-navigation|@expo-google-fonts/.*|@zxcvbn-ts/.*|@formatjs/.*|@frozik/.*|lodash-es|mobx|mobx-react-lite|temporal-polyfill))',
  ],
};
