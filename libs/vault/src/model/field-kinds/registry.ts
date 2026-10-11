import type { TFieldKind } from '../card';
import { BANK_ACCOUNT_FIELD } from './bank-account';
import { BANK_CODE_FIELD } from './bank-code';
import { BIC_FIELD } from './bic';
import { BOOLEAN_FIELD } from './boolean';
import { CARD_NUMBER_FIELD } from './card-number';
import { CVV_FIELD } from './cvv';
import { DATE_FIELD } from './date';
import { EMAIL_FIELD } from './email';
import { EXPIRY_DATE_FIELD } from './expiry-date';
import { EXPIRY_MONTH_FIELD } from './expiry-month';
import type { IFieldKind } from './field-kind';
import { FILE_FIELD } from './file';
import { IBAN_FIELD } from './iban';
import { LOGIN_FIELD } from './login';
import { MULTILINE_FIELD } from './multiline';
import { NOTE_FIELD } from './note';
import { OTP_FIELD } from './otp';
import { PASSWORD_FIELD } from './password';
import { PHONE_FIELD } from './phone';
import { PIN_FIELD } from './pin';
import { SECRET_FIELD } from './secret';
import { SECURITY_QUESTION_FIELD } from './security-question';
import { SELECT_FIELD } from './select';
import { TEXT_FIELD } from './text';
import { URL_FIELD } from './url';

/** One row per kind; a new kind is a new file and a line here. */
export const FIELD_KINDS: Readonly<Record<TFieldKind, IFieldKind>> = {
  text: TEXT_FIELD,
  login: LOGIN_FIELD,
  email: EMAIL_FIELD,
  phone: PHONE_FIELD,
  url: URL_FIELD,
  password: PASSWORD_FIELD,
  secret: SECRET_FIELD,
  pin: PIN_FIELD,
  otp: OTP_FIELD,
  'card-number': CARD_NUMBER_FIELD,
  cvv: CVV_FIELD,
  'expiry-month': EXPIRY_MONTH_FIELD,
  'expiry-date': EXPIRY_DATE_FIELD,
  date: DATE_FIELD,
  select: SELECT_FIELD,
  boolean: BOOLEAN_FIELD,
  iban: IBAN_FIELD,
  bic: BIC_FIELD,
  'bank-code': BANK_CODE_FIELD,
  'bank-account': BANK_ACCOUNT_FIELD,
  'security-question': SECURITY_QUESTION_FIELD,
  file: FILE_FIELD,
  multiline: MULTILINE_FIELD,
  note: NOTE_FIELD,
};
