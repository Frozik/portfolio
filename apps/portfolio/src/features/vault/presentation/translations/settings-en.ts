/** The settings page. */
export const settingsTranslationsEn = {
  open: 'Settings',
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
