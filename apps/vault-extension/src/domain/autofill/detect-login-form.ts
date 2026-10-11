import { isNil } from 'lodash-es';

import type { IFieldRecord } from './field-record';
import { CONFIRM_HINTS, OTP_HINTS, SEARCH_HINTS, USERNAME_HINTS } from './hint-table';

/** What the click fills, field by field; a sign-up form is recognised so it is left alone. */
export type TLoginForm =
  | { readonly kind: 'login'; readonly username: number | null; readonly password: number }
  | { readonly kind: 'username'; readonly username: number }
  | { readonly kind: 'otp'; readonly fields: readonly number[] }
  | { readonly kind: 'sign-up' }
  | { readonly kind: 'none' };

const TEXT_TYPES = new Set(['text', 'email', 'tel', '']);
const OTP_TYPES = new Set(['text', 'tel', 'number', '']);
/** Fewer single-character boxes than this are not a split one-time code. */
const SPLIT_OTP_MIN = 4;
const SPLIT_OTP_MAX = 8;

function usable(field: IFieldRecord): boolean {
  return field.visible && field.enabled;
}

function has(field: IFieldRecord, token: string): boolean {
  return field.autocomplete.includes(token);
}

function isPassword(field: IFieldRecord): boolean {
  return field.type === 'password';
}

function isUsernameLike(field: IFieldRecord): boolean {
  if (has(field, 'username') || has(field, 'email')) {
    return true;
  }
  return (
    TEXT_TYPES.has(field.type) &&
    !SEARCH_HINTS.test(field.hints) &&
    !OTP_HINTS.test(field.hints) &&
    !has(field, 'one-time-code')
  );
}

/** N visible one-character boxes side by side: one code, a character in each. */
function splitOtp(fields: readonly IFieldRecord[]): readonly number[] | null {
  const boxes = fields.filter(
    field => OTP_TYPES.has(field.type) && field.maxLength === 1 && usable(field)
  );
  const byParent = new Map<number, IFieldRecord[]>();
  for (const box of boxes) {
    byParent.set(box.parent, [...(byParent.get(box.parent) ?? []), box]);
  }
  const group = [...byParent.values()].find(
    members => members.length >= SPLIT_OTP_MIN && members.length <= SPLIT_OTP_MAX
  );
  return isNil(group) ? null : group.map(field => field.index);
}

function otpField(fields: readonly IFieldRecord[]): IFieldRecord | undefined {
  return (
    fields.find(field => has(field, 'one-time-code')) ??
    fields.find(
      field =>
        OTP_TYPES.has(field.type) &&
        OTP_HINTS.test(field.hints) &&
        !SEARCH_HINTS.test(field.hints) &&
        !has(field, 'username') &&
        !has(field, 'email')
    )
  );
}

/** The login in the password's form: the one the page names, else the nearest text field before it. */
function usernameFor(fields: readonly IFieldRecord[], password: IFieldRecord): number | null {
  const sameForm = fields.filter(field => field.container === password.container);
  const named = sameForm.find(field => has(field, 'username') || has(field, 'email'));
  if (!isNil(named)) {
    return named.index;
  }
  const before = sameForm.filter(field => field.index < password.index && isUsernameLike(field));
  return before.at(-1)?.index ?? null;
}

/**
 * The page's login form: the autocomplete tokens first,
 * then a password and the text field before it, then the names and labels.
 * A form that asks for a new password (sign-up, a password change without
 * the current one) is never filled with the stored one.
 */
export function detectLoginForm(all: readonly IFieldRecord[]): TLoginForm {
  const fields = all.filter(usable);
  const passwords = fields.filter(isPassword);
  const current =
    passwords.find(field => has(field, 'current-password')) ??
    (passwords.some(field => has(field, 'new-password'))
      ? undefined
      : passwords.find(field => !CONFIRM_HINTS.test(field.hints)));
  if (!isNil(current)) {
    const sameForm = passwords.filter(field => field.container === current.container);
    const looksLikeSignUp =
      !has(current, 'current-password') && sameForm.some(field => CONFIRM_HINTS.test(field.hints));
    return looksLikeSignUp
      ? { kind: 'sign-up' }
      : { kind: 'login', username: usernameFor(fields, current), password: current.index };
  }
  if (passwords.length > 0) {
    return { kind: 'sign-up' };
  }
  const split = splitOtp(fields);
  if (!isNil(split)) {
    return { kind: 'otp', fields: split };
  }
  const otp = otpField(fields);
  if (!isNil(otp)) {
    return { kind: 'otp', fields: [otp.index] };
  }
  const named = fields.find(field => has(field, 'username') || has(field, 'email'));
  const hinted = fields.find(field => isUsernameLike(field) && USERNAME_HINTS.test(field.hints));
  const username = named ?? hinted;
  return isNil(username) ? { kind: 'none' } : { kind: 'username', username: username.index };
}
