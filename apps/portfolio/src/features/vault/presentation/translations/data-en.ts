/** Import and export. */
export const dataTranslationsEn = {
  title: 'Data',
  import: {
    title: 'Import',
    intro:
      'A password CSV from Chrome, Edge, Firefox or Safari, a SafeInCloud XML export, a Bitwarden export (JSON or CSV), a KeePass database (.kdbx), a CXF file (.json or .zip), a screenshot of Google Authenticator’s transfer QR, or another .pwv vault. Nothing is saved before you confirm.',
    drop: 'Choose, drop or paste the exported file',
    failures: {
      'no-qr-code': 'There is no QR code in this picture.',
      unrecognized: 'This file is not an export the vault knows.',
      'encrypted-export':
        'This Bitwarden export is encrypted. Export again as “.json” without a password.',
      'read-only': 'The vault is open read-only: nothing was imported.',
    },
    vaultPassword: 'Password of that vault',
    vaultPasswordHint:
      'The vault opens here only to read its cards; nothing ties the two afterwards.',
    keePassPassword: 'Master password of the KeePass database',
    keePassPasswordHint:
      'The database opens here only to read its entries. Leave the password empty if it opens with a key file alone.',
    keyFile: 'Key file, if the database has one: choose or drop it',
    keyFileChosen: (name: string) => `Key file: ${name}`,
    keyFileRemove: 'Remove',
    open: 'Open',
    opening: 'Opening…',
    sources: {
      chrome: 'Chrome or Edge',
      firefox: 'Firefox',
      safari: 'Safari',
      bitwarden: 'Bitwarden',
      safeincloud: 'SafeInCloud',
      cxf: 'Credential Exchange Format (CXF)',
      keepass: 'KeePass',
      authenticator: 'Google Authenticator',
      pwv: 'Another vault',
    },
    found: (source: string, count: number) =>
      count === 1 ? `${source}: one entry.` : `${source}: ${count} entries.`,
    duplicates: (count: number) =>
      count === 1
        ? 'One of them is already here (the same site and login).'
        : `${count} of them are already here (the same site and login).`,
    duplicateChoices: {
      skip: 'Skip those',
      replace: 'Replace the cards (old versions stay in history)',
      'keep-both': 'Keep both',
    },
    warnings: {
      'row-skipped': (row: number) => `Row ${row} could not be read and is skipped.`,
      'field-dropped': (card: string, label: string) =>
        `“${card}”: the linked field “${label}” has no counterpart here.`,
      'passkey-dropped': (card: string) => `“${card}”: its passkey stays in Bitwarden.`,
      'file-dropped': (card: string, name: string) =>
        `“${card}”: the attachment ${name === '' ? '(a picture)' : `“${name}”`} does not come along; attach it again.`,
      'item-skipped': (title: string) => `“${title}” is of a kind the vault does not hold.`,
    },
    confirm: 'Import',
    importing: 'Importing…',
    cancel: 'Cancel',
    done: (added: number, replaced: number, skipped: number) =>
      `Imported: ${added} new, ${replaced} replaced, ${skipped} skipped.`,
    filesDropped: (count: number) =>
      `${count} file(s) did not fit the vault’s 5 MB limit; their fields came in empty.`,
    another: 'Import another file',
  },
  export: {
    title: 'Export',
    formats: {
      pwv: 'Encrypted copy (.pwv) with its own password',
      zip: 'Open archive (.zip): everything, files included',
      cxf: 'Credential Exchange Format (.cxf.zip) for other password managers',
      csv: 'CSV for other password managers (Bitwarden columns)',
    },
    descriptions: {
      pwv: 'A separate vault with a new key: you can hand it over or keep it apart. It does not reveal your master password and does not sync with this vault.',
      zip: 'The vault’s contents as JSON with each card’s files, readable by any archiver.',
      cxf: 'The FIDO Alliance’s format: logins, cards, Wi-Fi, documents, one-time codes, groups, links and files. Not encrypted.',
      csv: 'Accounts as logins, other cards as notes with their fields. Files are left out.',
    },
    exportPassword: 'Password of the copy',
    exportPasswordHint: (min: number) =>
      `At least ${min} characters; you will need it to open the copy.`,
    confirmation: 'Repeat the password',
    masterPassword: 'Master password',
    masterPasswordHint: 'Asked again because the file will not be encrypted.',
    acknowledgement:
      'I understand the file is not encrypted: anyone who gets it reads every password.',
    problems: {
      'too-short': (min: number) => `The password needs at least ${min} characters.`,
      mismatch: 'The passwords differ.',
      'not-acknowledged': 'Confirm that you understand the file is not encrypted.',
      'no-password': 'Type the master password.',
    },
    prepare: 'Prepare the file',
    preparing: 'Preparing…',
    save: (name: string) => `Save ${name}`,
    missingFiles: (count: number) =>
      count === 1
        ? 'One file is neither on this device nor in the cloud and is not in the archive.'
        : `${count} files are neither on this device nor in the cloud and are not in the archive.`,
    saved: 'Saved.',
    again: 'Export again',
  },
};
