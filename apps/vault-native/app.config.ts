import type { ConfigContext, ExpoConfig } from 'expo/config';
import type { ConfigPlugin } from 'expo/config-plugins';
import { withMainActivity } from 'expo/config-plugins';

/** The app's Android identity: fixed once published, the signing key and the installed copies depend on it. */
const ANDROID_PACKAGE = 'io.github.ciphravault.vault';
/** A development build installs below every release. */
const DEVELOPMENT_VERSION_CODE = 1;
/** What a vault file or another manager's database arrives as from a file manager or a messenger. */
const TAKEN_IN_TYPES = [
  'application/octet-stream',
  'application/x-sqlite3',
  'application/vnd.sqlite3',
];

const SUPER_ON_CREATE = 'super.onCreate(null)';
const SECURE_WINDOW =
  'window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)';

/**
 * The window is secure from its first frame: screenshots, recordings and the recents picture show
 * nothing until the JavaScript side lifts the flag for an unlocked vault that allows it. Set from
 * JavaScript alone, it came too late on a cold start (the call failed before the activity was
 * attached, and was never retried) and was lost whenever Android recreated the window.
 */
const withSecureWindow: ConfigPlugin = config =>
  withMainActivity(config, activity => {
    if (activity.modResults.contents.includes(SECURE_WINDOW)) {
      return activity;
    }
    if (!activity.modResults.contents.includes(SUPER_ON_CREATE)) {
      throw new Error(
        `MainActivity no longer calls ${SUPER_ON_CREATE}: place the secure flag anew`
      );
    }
    activity.modResults.contents = activity.modResults.contents
      .replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport android.view.WindowManager'
      )
      .replace(SUPER_ON_CREATE, `${SECURE_WINDOW}\n    ${SUPER_ON_CREATE}`);
    return activity;
  });

export default ({ config }: ConfigContext): ExpoConfig =>
  withSecureWindow({
    ...config,
    name: 'Ciphra Vault',
    slug: 'ciphra-vault',
    version: process.env.VAULT_NATIVE_VERSION?.replace(/^v/, '') ?? '0.0.0',
    // Only a release names itself one: a local build (0.0.0) would otherwise read every release as newer.
    extra: { release: process.env.VAULT_NATIVE_VERSION ?? null },
    platforms: ['android'],
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    android: {
      package: ANDROID_PACKAGE,
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0f1320' },
      // The release computes it from the tag (`android-version-code`): every release installs over the one before.
      versionCode: Number(process.env.VAULT_NATIVE_VERSION_CODE ?? DEVELOPMENT_VERSION_CODE),
      // On Android 13–15 React Native 0.86 hears back only through onBackPressed, which this flag turns off.
      predictiveBackGestureEnabled: false,
      // The vault leaves the phone only through the user's own cloud, never through a backup.
      allowBackup: false,
      // "Open with" and "Share" offer the app for a vault file (Android names a .pwv a plain
      // binary) and for another manager's database, which a file manager may call SQLite.
      intentFilters: [
        {
          action: 'VIEW',
          category: ['DEFAULT'],
          data: TAKEN_IN_TYPES.flatMap(mimeType => [
            { scheme: 'content', mimeType },
            { scheme: 'file', mimeType },
          ]),
        },
        {
          action: 'SEND',
          category: ['DEFAULT'],
          data: TAKEN_IN_TYPES.map(mimeType => ({ mimeType })),
        },
      ],
    },
    // No over-the-air code: every change ships as a signed APK the user can verify.
    updates: { enabled: false },
    plugins: [
      'expo-router',
      // The camera reads QR codes of one-time codes; nothing is recorded, so no microphone.
      ['expo-camera', { recordAudioAndroid: false, microphonePermission: false }],
    ],
  });
