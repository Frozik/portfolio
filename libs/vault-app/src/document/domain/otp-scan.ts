import type { IOtpParams } from '@frozik/vault/model/validation/otpauth-uri';
import {
  formatOtpUri,
  isBareSecret,
  parseOtpUri,
} from '@frozik/vault/model/validation/otpauth-uri';
import { parseOtpMigration } from '@frozik/vault/otp/otp-migration';
import { isNil } from 'lodash-es';

import type { TReadQrCode } from './ports/qr-reader';

/** What a QR code gave a one-time-code field. */
export type TOtpScan =
  /** What goes into the field: an `otpauth://` URI, or a bare secret the field turns into one with the card's title. */
  | { readonly kind: 'code'; readonly value: string }
  /** Google Authenticator's transfer of several accounts: the user picks the one this card is for. */
  | { readonly kind: 'choose'; readonly codes: readonly IOtpParams[] }
  | { readonly kind: 'none' };

/** An `otpauth://` code, or a transfer QR with one or several accounts. */
export async function scanOtp(
  readQrCode: TReadQrCode,
  image: Parameters<TReadQrCode>[0]
): Promise<TOtpScan> {
  const text = await readQrCode(image);
  if (isNil(text)) {
    return { kind: 'none' };
  }
  const single = parseOtpUri(text);
  if (single.ok) {
    return { kind: 'code', value: formatOtpUri(single.value) };
  }
  if (isBareSecret(text.trim())) {
    return { kind: 'code', value: text.trim() };
  }
  const migration = parseOtpMigration(text);
  if (!migration.ok) {
    return { kind: 'none' };
  }
  const [only, ...others] = migration.value;
  return !isNil(only) && others.length === 0
    ? { kind: 'code', value: formatOtpUri(only) }
    : { kind: 'choose', codes: migration.value };
}
