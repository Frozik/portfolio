/** The audit dashboard. */
export const auditTranslationsEn = {
  open: 'Audit',
  title: 'Password audit',
  back: 'Back to the vault',
  intro:
    'What the vault can tell about your passwords, here, on this device: strength is estimated in the browser, nothing is sent anywhere unless you allow the breach check below.',
  categories: {
    leaked: 'Found in breaches',
    weak: 'Weak',
    reused: 'Reused on several sites',
    'insecure-url': 'Plain-HTTP address',
    'no-2fa': 'Site offers one-time codes, card has none',
    old: 'Unchanged too long: a year, or the period the card sets',
    expired: 'Expired',
    expiring: 'Expiring soon',
  },
  clean: 'Nothing to report.',
  changePassword: 'Change the password on the site',
  checkLeaks: 'Check passwords against Have I Been Pwned',
  checkLeaksNote:
    'Only the first five characters of each password’s SHA-1 hash are sent, padded so the answer reveals nothing; the password never leaves the page.',
  twoFactorCredit: 'Data sourced from 2FA Directory by 2factorauth (MIT).',
  directoryMissing:
    'The list of sites with one-time codes could not be loaded; that check is skipped.',
};
