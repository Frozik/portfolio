/** The Google Drive and WebDAV panels. */
export const cloudTranslationsEn = {
  drive: {
    connect: 'Connect Google Drive…',
    title: 'Google Drive',
    spaces: {
      'my-drive': {
        label: 'A Vault folder in My Drive',
        description:
          'You see the file in Drive and can back it up or move it. The site gets access only to the files it creates.',
      },
      'app-data': {
        label: 'The app’s hidden folder',
        description:
          'Nothing to stumble on in Drive, and the site sees nothing else there. Removing the site’s access in Google settings deletes the vault from Drive.',
      },
    },
    loading: 'Loading Google sign-in…',
    signIn: 'Sign in with Google',
    signingIn: 'Waiting for Google…',
    looking: 'Looking into the Vault folder…',
    noVaults: 'Signed in. There is no vault in this folder yet.',
    vaultsFound: (count: number) =>
      count === 1 ? 'Signed in. One vault is here:' : `Signed in. ${count} vaults are here:`,
    authFailures: {
      unavailable: 'Google sign-in could not load. Check the connection or a blocking extension.',
      'popup-blocked':
        'The browser blocked the Google window. Allow pop-ups for this site and try again.',
      'popup-closed': 'The Google window was closed before signing in.',
      'scope-denied':
        'Google did not grant access to Drive. Sign in again and keep the Drive permission ticked.',
      refused: 'Google refused the sign-in.',
    },
  },
  webdav: {
    connect: 'Connect a WebDAV folder…',
    title: 'WebDAV folder',
    intro:
      'Nextcloud, ownCloud, a NAS or rclone. The page talks to the server directly, so the server has to allow this site (CORS).',
    service: 'Service',
    customService: 'Another WebDAV server (type the address)',
    selfHosted: 'Your own server',
    hosted: 'Hosted services',
    server: 'Server address',
    serverHint: 'cloud.example.org',
    hostedNoBrowser:
      'This service does not let web pages in (no CORS), so the check here will fail. Connect it in the Chrome extension, which needs no CORS, with the same address.',
    address: 'Folder address',
    addressHint: 'https://cloud.example.org/remote.php/dav/files/me/Vault/',
    addressProblems: {
      empty: 'Enter the folder address.',
      invalid: 'This is not a web address.',
      insecure: 'Only HTTPS: the password goes with every request.',
    },
    username: 'Login',
    password: 'App password',
    passwordHint:
      'Make an app password for the vault in the server settings, not your account password.',
    check: 'Check',
    checking: 'Checking the server…',
    cancel: 'Close',
    reachable: 'The server is reachable and the folder is writable.',
    atomic:
      'It refuses a write over a version it did not expect: devices never overwrite each other.',
    checkThenWrite:
      'It cannot refuse a stale write itself: the vault checks first, and the merge keeps edits two devices made at the same moment.',
    moveReplace: 'A write lands in one step: an interrupted upload never leaves half a file.',
    noMoveReplace:
      'A write is not atomic on this server: an interrupted upload can leave a damaged file until the next one.',
    lastModified: 'The server gives no ETags: versions are told apart by time, to the second.',
    failures: {
      'cors-blocked':
        'The page could not reach the server. Either the address is wrong or the server does not allow this site — set up CORS:',
      'auth-required': 'The server refused the login or the password.',
      'not-a-folder': 'The address names a file, not a folder.',
      'no-revisions':
        'The server reports neither ETags nor modification times: versions of the file cannot be told apart.',
      'not-found': 'There is no such folder on the server.',
      quota: 'The server has no space left.',
      offline: 'No network connection.',
      'rate-limited': 'The server asks to wait: try again in a minute.',
      server: (status: number) => `The server answered with an error (${status}).`,
      aborted: 'The check was cancelled.',
      unavailable: 'The server cannot be used now.',
    },
    corsFor: {
      nextcloud: 'Nextcloud',
      rclone: 'rclone',
      apache: 'Apache',
      nginx: 'nginx',
      caddy: 'Caddy',
    },
  },
  status: {
    syncNow: 'Sync now: take the other devices’ changes and send this one’s',
    unreachable: 'Cloud: the password for it is gone — reconnect in the settings',
    otherTab: 'Cloud: synced by another tab',
    syncing: 'Syncing…',
    synced: 'Synced with the cloud',
    signInNeeded: 'Not synced: Google sign-in expired',
    signIn: 'Sign in to Google',
    offline: 'Not synced · offline',
    quota: 'Not synced: the cloud is full',
    retrying: 'Not synced yet — will retry',
  },
  section: {
    title: 'Cloud',
    localOnly: 'This browser only — connect a cloud or export, so the vault survives this device.',
    driveIn: (folder: string, path: string) => `Google Drive · ${folder} · ${path}`,
    webdavIn: (url: string, path: string) => `WebDAV · ${url}${path}`,
    mergesWith:
      'A vault file is already there: keeping this vault here merges with it if it is the same vault, and stops if it is another one.',
    noVaultsToOpen: 'There is no vault here.',
    open: 'Open',
    keepHere: 'Keep this vault here',
    disconnect: 'Disconnect the cloud',
    disconnectNote: 'The file stays in the cloud; this device stops syncing with it.',
  },
  opening: {
    title: 'Open from a cloud',
    intro:
      'A vault kept in Google Drive or a WebDAV folder: it is downloaded to this browser and opened with its master password.',
    open: 'Open from a cloud…',
    notFound: 'The file is gone from the cloud.',
    notAVault: 'This file is not a vault.',
    device: 'This browser refused to store the vault.',
  },
  foreign: {
    title: 'Another vault is in the cloud',
    description: (path: string) =>
      `The file ${path} belongs to a different vault, so nothing was merged.`,
    replace: 'Replace it with this vault',
    replaceFailed: 'The cloud refused the file. Try again later.',
    openOther:
      'To use the other vault, open it from the start screen with “Open from a cloud” and its own master password.',
  },
};
