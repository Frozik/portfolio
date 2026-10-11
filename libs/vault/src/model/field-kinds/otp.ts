import {
  bareSecretToUri,
  formatOtpUri,
  isBareSecret,
  parseOtpUri,
} from '../validation/otpauth-uri';
import { defineFieldKind, invalid, VALID } from './field-kind';

/** Stored as the canonical `otpauth://` URI; a bare base32 secret becomes one. */
export const OTP_FIELD = defineFieldKind({
  kind: 'otp',
  sensitiveByDefault: true,
  listAllowed: false,
  searchable: false,
  defaultSpec: { kind: 'otp' },
  normalize: (value, { card }) => {
    const trimmed = value.trim();
    if (isBareSecret(trimmed)) {
      return bareSecretToUri(trimmed, card.title);
    }
    const parsed = parseOtpUri(trimmed);
    return parsed.ok ? formatOtpUri(parsed.value) : trimmed;
  },
  validate: value => (parseOtpUri(value).ok ? VALID : invalid('otp-format')),
});
