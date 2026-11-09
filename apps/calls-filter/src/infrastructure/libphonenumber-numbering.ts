import { Metadata } from 'libphonenumber-js/core';
import type { CountryCode, NumberType } from 'libphonenumber-js/max';
import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/max';
import MAX_METADATA from 'libphonenumber-js/metadata.max.json';

import type { INumberTraits, TE164Digits, TNumberType } from '../contexts/phone/domain/caller';
import type { IDialingRegion, TCountryCode } from '../contexts/phone/domain/dialing-region';
import type { IPhoneNumbering } from '../contexts/phone/domain/ports/phone-numbering';

const TYPES: Readonly<Partial<Record<NonNullable<NumberType>, TNumberType>>> = {
  MOBILE: 'mobile',
  FIXED_LINE: 'fixed-line',
  FIXED_LINE_OR_MOBILE: 'fixed-line',
  PREMIUM_RATE: 'premium-rate',
  SHARED_COST: 'shared-cost',
  VOIP: 'voip',
  TOLL_FREE: 'toll-free',
};

/** The library has the method at runtime but leaves it out of its typings. */
function hasNationalPrefix(plan: unknown): plan is { nationalPrefix(): unknown } {
  return (
    typeof plan === 'object' &&
    plan !== null &&
    typeof (plan as { nationalPrefix?: unknown }).nationalPrefix === 'function'
  );
}

/** The numbering plan through libphonenumber-js with its full metadata (number types need it). */
export const LIBPHONENUMBER_NUMBERING: IPhoneNumbering = {
  region(country) {
    if (!isSupportedCountry(country)) {
      return null;
    }
    const metadata = new Metadata(MAX_METADATA);
    metadata.selectNumberingPlan(country as CountryCode);
    const plan: unknown = metadata.numberingPlan;
    const prefix = hasNationalPrefix(plan) ? plan.nationalPrefix() : null;
    return {
      country,
      callingCode: getCountryCallingCode(country as CountryCode),
      nationalPrefix: typeof prefix === 'string' && prefix !== '' ? prefix : null,
    } satisfies IDialingRegion;
  },
  parse(raw, home) {
    const parsed = parsePhoneNumberFromString(
      raw,
      isSupportedCountry(home) ? (home as CountryCode) : undefined
    );
    return parsed === undefined ? null : (parsed.number.slice(1) as TE164Digits);
  },
  traits(digits): INumberTraits {
    const parsed = parsePhoneNumberFromString(`+${digits}`);
    const type = parsed?.getType();
    return {
      country: (parsed?.country ?? null) as TCountryCode | null,
      type: (type === undefined ? undefined : TYPES[type]) ?? 'other',
    };
  },
  format(digits) {
    return parsePhoneNumberFromString(`+${digits}`)?.formatInternational() ?? `+${digits}`;
  },
};
