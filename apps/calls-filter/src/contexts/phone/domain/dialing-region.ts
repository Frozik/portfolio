import type { Brand } from '@frozik/utils/types/base';

/** ISO 3166-1 alpha-2, upper case: `NL`, `RU`, `FI`. */
export type TCountryCode = Brand<string, 'CountryCode'>;

/** How numbers are dialed inside a country: what a national number is written with. */
export interface IDialingRegion {
  readonly country: TCountryCode;
  /** The country calling code without the plus: `31`, `7`. */
  readonly callingCode: string;
  /** The trunk prefix a national number starts with (`0`, `8`), or `null` where there is none. */
  readonly nationalPrefix: string | null;
}
