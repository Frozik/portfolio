/** The master password, and what else opens the vault. */
export const keysTranslationsEn = {
  changePassword: {
    title: 'Master password',
    intro:
      'Changing it keeps the vault’s key: every device takes the new password with its next sync, and until then opens with the old one.',
    open: 'Change the master password…',
    current: 'Current master password',
    currentRecovery: 'Recovery key',
    password: 'New master password',
    passwordHint: (min: number) => `At least ${min} characters.`,
    confirmation: 'Repeat the new password',
    problems: {
      'no-current': 'Type the current master password.',
      'too-short': (min: number) => `The new password needs at least ${min} characters.`,
      mismatch: 'The new passwords differ.',
    },
    submit: 'Change the password',
    changing: 'Changing: deriving the new key…',
    changed: 'The master password is changed. Other devices take it with their next sync.',
    cancel: 'Cancel',
  },
  recoveryKey: {
    title: 'Recovery key',
    none: 'No recovery key yet: if the master password is forgotten, nothing opens the vault.',
    present: 'A recovery key is set. A new one stops the old Emergency Kit from working.',
    create: 'Create a recovery key…',
    replace: 'Make a new recovery key…',
    shown:
      'Write it down, or save the Emergency Kit and print it. It is shown only now and is not kept anywhere.',
    saveKit: 'Save the Emergency Kit (PDF)',
    kitMaking: 'Preparing the Emergency Kit…',
    kitFailed: 'The Emergency Kit could not be made; write the key down instead.',
    written: 'I have it',
    lastGroup: 'The last group of the key',
    lastGroupHint: 'Typed from what you wrote down or printed, so it surely reads.',
    password: 'Master password',
    confirm: 'Turn the recovery key on',
    saving: 'Saving…',
    done: 'The recovery key opens the vault from now on, on every device after sync.',
    cancel: 'Cancel',
  },
  recovering: {
    message: 'Opened with the recovery key.',
    description: 'Set a new master password in the settings, with the same recovery key.',
    action: 'Set a new master password',
  },
  unlock: {
    useRecovery: 'Forgot the password? Use the recovery key',
    usePassword: 'Use the master password',
    recoveryKey: 'Recovery key',
    wrongKey: 'This recovery key does not open the vault.',
  },
  recoveryKeyProblems: {
    malformed: 'That is not a recovery key: 28 letters and digits in groups of four.',
    'checksum-mismatch': 'There is a typo in the recovery key.',
  },
  kit: {
    title: 'Emergency Kit',
    intro:
      'Keep this page somewhere safe and offline. With the recovery key it opens the vault when the master password is forgotten.',
    vault: 'Vault',
    location: 'Where it is kept',
    created: 'Made on',
    recoveryKey: 'Recovery key',
    masterPassword: 'Master password',
    masterPasswordHint:
      'Write it here by hand, or keep it only in your head. The site never prints it.',
    howTo: 'How to get back in',
    steps: (site: string) => [
      `1. Open ${site}.`,
      '2. Choose the vault, or "Open from a cloud" on a new device.',
      '3. Choose "Use the recovery key" and type the key above.',
      '4. Set a new master password in the settings.',
    ],
  },
  rotation: {
    title: 'A new key for the vault',
    intro:
      'When you fear the key itself leaked — a lost device that was unlocked, an old backup in the wrong hands — everything is sealed again under a new key. The master password stays the same.',
    consequences: [
      'The recovery key stops working: make a new one afterwards.',
      'Every other device asks for the master password once, at its next sync.',
      'The vault locks when it is done.',
      'Earlier versions of the file a cloud keeps (Google Drive revisions, a WebDAV server’s backups) still open with the old key and the old password: delete them there.',
    ],
    password: 'Master password',
    submit: 'Seal everything under a new key',
    working: 'Sealing under the new key…',
    failures: {
      'not-synced': 'Let the vault finish syncing first, so nothing is left behind.',
      'changed-meanwhile':
        'Another device wrote the vault meanwhile. Unlock and try again: nothing is lost.',
      'rollback-security':
        'The cloud holds the vault under a key this device retired: an old copy was put back. Nothing was changed.',
    },
  },
  following: {
    message: 'The vault’s key was changed on another device.',
    description:
      'Type the master password to switch to the new key. What you changed here meanwhile is kept; the vault locks once it is done.',
    password: 'Master password',
    submit: 'Switch to the new key',
    working: 'Switching…',
  },
  passkeys: {
    title: 'Passkeys',
    intro:
      'A passkey of this device (Touch ID, Windows Hello, a phone, a security key) opens the vault without the master password. The authenticator must support the PRF extension; the master password keeps working too.',
    none: 'No passkeys yet.',
    item: (index: number, id: string) => `Passkey ${index} · ${id}`,
    remove: 'Remove',
    password: 'Master password',
    passwordHint: 'Asked once, to let the passkey wrap the vault’s key.',
    check: 'Continue',
    checking: 'Checking…',
    create: 'Create a passkey on this device',
    asking: 'Follow the browser’s prompt…',
    added: 'The passkey opens the vault from now on, on every device after sync.',
    unsupported: 'This browser cannot open a vault with a passkey.',
    failures: {
      unsupported: 'This browser has no passkeys.',
      cancelled: 'The prompt was closed; nothing was added.',
      'no-prf':
        'This authenticator made the passkey but cannot derive a key from it (no PRF). Try another one, such as the platform’s own.',
      failed: 'The browser could not make the passkey.',
    },
    again: 'Add another passkey',
    unlock: 'Unlock with a passkey',
    unlocking: 'Waiting for the passkey…',
    wrongPasskey: 'This passkey does not open the vault any more.',
  },
  changedElsewhere: {
    message: 'The master password was changed on another device.',
    description: 'This vault opens with the new password from now on.',
    dismiss: 'Got it',
  },
};
