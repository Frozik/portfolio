import type { ITexts } from './texts';

/** The sync section's words: Google Drive, the states of a sync, its failures. */
export const EN_SYNC: ITexts['sync'] = {
  title: 'Sync',
  what: 'Your groups are kept in a hidden folder of your own Google Drive and stay the same on every phone you connect. Only this app can see that folder.',
  connect: 'Connect Google Drive',
  now: 'Sync now',
  disconnect: 'Disconnect',
  replace: "Replace the cloud copy with this phone's",
  account: account => account ?? 'Google account',
  state: {
    off: 'Not connected',
    syncing: 'Syncing…',
    synced: moment => `Synced ${moment}`,
    offline: 'No network — will sync when it is back',
    'auth-required': 'Google needs you to connect again',
    'rate-limited': 'Google asked to wait — will try again later',
    server: 'Google Drive did not answer — will try again later',
    quota: 'Your Google Drive is full',
    unreadable: 'The cloud copy cannot be read; it was left untouched',
    newer: 'A newer version of the app wrote the cloud copy; update the app to sync',
  },
};
