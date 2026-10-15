import type { ConfigContext, ExpoConfig } from 'expo/config';

/** The app's Android identity: fixed once published, the signing key and the installed copies depend on it. */
const ANDROID_PACKAGE = 'io.github.ciphravault.vault';
/** A development build installs below every release. */
const DEVELOPMENT_VERSION_CODE = 1;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Ciphra Vault',
  slug: 'ciphra-vault',
  version: process.env.VAULT_NATIVE_VERSION?.replace(/^v/, '') ?? '0.0.0',
  platforms: ['android'],
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0f1320' },
    // The release computes it from the tag (`android-version-code`): every release installs over the one before.
    versionCode: Number(process.env.VAULT_NATIVE_VERSION_CODE ?? DEVELOPMENT_VERSION_CODE),
    predictiveBackGestureEnabled: true,
    // The vault leaves the phone only through the user's own cloud, never through a backup.
    allowBackup: false,
  },
  // No over-the-air code: every change ships as a signed APK the user can verify.
  updates: { enabled: false },
  plugins: ['expo-router'],
});
