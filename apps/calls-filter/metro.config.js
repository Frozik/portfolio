// Expo finds the workspace on its own; the shared libraries ship TypeScript sources with `exports`.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
