// Expo finds the workspace on its own; the shared libraries ship TypeScript sources with `exports`.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;

// kdbxweb requires Node's `crypto` for a branch it takes only without WebCrypto; on the
// phone quick-crypto is both, so the KeePass reader finds the same implementation either way.
const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) =>
  moduleName === 'crypto'
    ? context.resolveRequest(context, 'react-native-quick-crypto', platform)
    : (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);

// React Native asks for lazy bundles in development, and Metro names a lazily split `import()` by
// its path without the extension: a package whose `main` is `index.cjs` beside an `index.mjs` (the
// zxcvbn dictionaries) gets a bundle of the `.mjs`, and the app waits for a module that never
// comes. Release bundles never split, so development loads code the way the APK does.
const rewriteDefault = config.server.rewriteRequestUrl;
config.server.rewriteRequestUrl = url =>
  (rewriteDefault ?? (same => same))(url).replace(/([?&])lazy=true\b/, '$1lazy=false');

module.exports = config;
