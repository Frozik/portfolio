/**
 * Where in the user's Drive the vault lives, chosen per vault
 * when it is connected: a visible `Vault` folder in My Drive (the user sees
 * the file and can back it up or share it), or the app's hidden folder
 * (nothing to stumble on, but gone when the user removes the app's access).
 */
export type TDriveSpace = 'my-drive' | 'app-data';

/** Both non-sensitive: an app asking only for these is published without Google's verification. */
export const DRIVE_SCOPES: Readonly<Record<TDriveSpace, string>> = {
  'my-drive': 'https://www.googleapis.com/auth/drive.file',
  'app-data': 'https://www.googleapis.com/auth/drive.appdata',
};

/** The id Drive accepts for the top folder of a space. */
export const DRIVE_ROOTS: Readonly<Record<TDriveSpace, string>> = {
  'my-drive': 'root',
  'app-data': 'appDataFolder',
};

/** `files.list` searches only `drive` unless told otherwise; the hidden folder is its own space. */
export const DRIVE_LIST_SPACES: Readonly<Record<TDriveSpace, string>> = {
  'my-drive': 'drive',
  'app-data': 'appDataFolder',
};
