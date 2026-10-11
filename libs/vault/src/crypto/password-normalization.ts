import type { TBytes } from './bytes';
import { utf8 } from './bytes';

/**
 * NFC before UTF-8: macOS and Windows input fields hand over
 * "й" decomposed and composed, which would otherwise be two passwords.
 * Whitespace and case are the user's and stay as typed.
 */
export function encodePassword(password: string): TBytes {
  return utf8(password.normalize('NFC'));
}
