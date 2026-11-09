import type { ConfigContext, ExpoConfig } from 'expo/config';

/** The app's Android identity: fixed once published, the signing key and the installed copies depend on it. */
const ANDROID_PACKAGE = 'io.github.frozik.callsfilter';
/** A development build installs below every release. */
const DEVELOPMENT_VERSION_CODE = 1;
/** `CALLS_FILTER_SMS=0` builds the edition without SMS: Play Protect blocks a downloaded APK that asks for SMS in some countries. */
const SMS_REPLY = process.env.CALLS_FILTER_SMS !== '0';
const SEND_SMS = 'android.permission.SEND_SMS';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Calls Filter',
  slug: 'calls-filter',
  scheme: 'callsfilter',
  version: process.env.CALLS_FILTER_VERSION?.replace(/^v/, '') ?? '0.0.0',
  platforms: ['android'],
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#10161f' },
    versionCode: Number(process.env.CALLS_FILTER_VERSION_CODE ?? DEVELOPMENT_VERSION_CODE),
    predictiveBackGestureEnabled: true,
    allowBackup: false,
    permissions: [
      'android.permission.READ_CONTACTS',
      'android.permission.READ_CALENDAR',
      'android.permission.READ_CALL_LOG',
      'android.permission.READ_PHONE_STATE',
      'android.permission.POST_NOTIFICATIONS',
      ...(SMS_REPLY ? [SEND_SMS] : []),
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    ],
    blockedPermissions: SMS_REPLY ? [] : [SEND_SMS],
  },
  updates: { enabled: false },
  extra: { ...config.extra, smsReply: SMS_REPLY },
  plugins: [
    'expo-router',
    ['expo-localization', { supportedLocales: ['en', 'ru'] }],
    ['expo-location', { isAndroidBackgroundLocationEnabled: true }],
  ],
});
