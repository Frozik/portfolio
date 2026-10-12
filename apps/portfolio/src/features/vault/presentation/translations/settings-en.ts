/** The settings page. */
export const settingsTranslationsEn = {
  open: 'Settings',
  backups: {
    title: 'Backups on this device',
    intro:
      'Earlier versions of the vault, sealed with its key: kept before another device’s changes come in, before a rollback, and once an hour while you edit.',
    kept: 'Keep',
    keptCount: (count: number) => `${count} backups`,
    none: 'No backups yet.',
    reasons: {
      'before-sync': 'before a sync',
      periodic: 'while editing',
      'before-restore': 'before a rollback',
    },
    restore: 'Roll back',
    restoreTitle: (when: string) => `Roll the vault back to ${when}?`,
    restoreMessage:
      'Changed cards get the version they had then; their current version stays in each card’s history. Cards made since go to the trash, cards deleted since come back. The vault as it is now is kept as a backup first, so this can be undone. Every device takes the rollback with its next sync.',
    restored: (restored: number, revived: number, trashed: number) =>
      `Rolled back: ${restored} cards restored, ${revived} brought back, ${trashed} moved to the trash.`,
    olderKey:
      'This backup was sealed before the vault got a new key and cannot be opened any more.',
    unreadable: 'This backup could not be read.',
  },
  title: 'Settings',
  back: 'Back to the vault',
  security: 'Security on this device',
  idleLock: 'Lock after inactivity',
  hiddenLock: 'Lock when the tab is in the background',
  clipboardClear: 'Clear a copied secret after',
  siteIcons: 'Site icons',
  siteIconsToggle: 'Load each site’s icon',
  siteIconsNote:
    'The icon service learns a site’s domain once; the icon is kept in the vault and synced. Off: cards show built-in icons.',
  clipboardNote:
    'The page cannot read the clipboard, so it clears it whatever is there by then. Clipboard history tools see what you copy.',
  minutes: (count: number) => (count === 1 ? '1 minute' : `${count} minutes`),
  hours: (count: number) => (count === 1 ? '1 hour' : `${count} hours`),
  seconds: (count: number) => `${count} seconds`,
  atOnce: 'At once',
  never: 'Never',
  vault: 'This vault',
  name: 'Name',
  rename: 'Rename',
  description: 'Description',
  descriptionHint:
    'Shown in this device’s list of vaults before the password is typed, like the name. Keep secrets out of it.',
  saveTitle: 'Save',
  forget: 'Delete this vault from this device',
  forgetTitle: 'Delete this vault from this device?',
  forgetMessage:
    'Its copy in this browser and everything this device kept of it go. A vault that lives only here is gone for good.',
  forgetConfirm: 'Delete',
  cancel: 'Cancel',
  about: 'About',
  formatVersion: (version: number) => `Vault format version ${version}`,
  credits: 'Credits',
  creditsList: [
    'EFF Large Wordlist for passphrases — Electronic Frontier Foundation, CC BY 3.0 US',
    'Change-password addresses and shared sign-ins — apple/password-manager-resources, MIT',
    'Password strength — zxcvbn-ts, MIT',
    'Argon2id — hash-wasm, MIT',
  ],
};
