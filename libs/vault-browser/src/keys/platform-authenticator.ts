import type { TPlatformAuthenticator } from '@frozik/vault-app/keys/domain/ports/passkeys';

/**
 * What the platform's own authenticator is called, read from the user agent:
 * iPhone and iPad have Face ID on most models (Touch ID on the rest; both open
 * a passkey the same way), a Mac has Touch ID, Windows has Hello, Android a
 * fingerprint. Anything else gets the plain word.
 */
export function platformAuthenticatorOf(userAgent: string): TPlatformAuthenticator {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return 'face-id';
  }
  if (/Macintosh/.test(userAgent)) {
    return 'touch-id';
  }
  if (/Windows/.test(userAgent)) {
    return 'windows-hello';
  }
  return /Android/.test(userAgent) ? 'fingerprint' : 'passkey';
}
