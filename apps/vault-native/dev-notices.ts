import { LogBox } from 'react-native';

// The app has no custom URL scheme on purpose (no other app may deep-link into a vault). Expo
// Router then asks expo-linking for a root URL, which warns in development and falls back to
// the package name; a release launch was checked to open and route normally without it.
LogBox.ignoreLogs(['Linking requires a build-time setting `scheme`']);
