import type { INumberTraits, TE164Digits } from '../caller';
import type { IDialingRegion, TCountryCode } from '../dialing-region';

/** The numbering plan of the world: what libphonenumber knows, behind a port. */
export interface IPhoneNumbering {
  region(country: TCountryCode): IDialingRegion | null;
  /** A number as typed or pasted, read as dialled from `home`; `null` when it is no number. */
  parse(raw: string, home: TCountryCode): TE164Digits | null;
  traits(digits: TE164Digits): INumberTraits;
  /** Digits written for people: `+31 6 12345678`. */
  format(digits: TE164Digits): string;
}
