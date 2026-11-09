import type { Brand } from '@frozik/utils/types/base';

import type { TCountryCode } from './dialing-region';
import type { TNormalizedName } from './name-normalization';

/** The international digits of a number, without the plus: `31612345678`. */
export type TE164Digits = Brand<string, 'E164Digits'>;

export type TNumberType =
  | 'mobile'
  | 'fixed-line'
  | 'premium-rate'
  | 'shared-cost'
  | 'voip'
  | 'toll-free'
  | 'other';

export interface INumberTraits {
  readonly country: TCountryCode | null;
  readonly type: TNumberType;
}

/** The caller as found in the address book at the moment of the call. */
interface ICallerContact {
  readonly lookupKey: string;
  readonly displayName: string;
  readonly name: TNormalizedName;
}

/** Everything a call says about who is calling; `number: null` is a hidden number. */
export interface ICaller {
  readonly number: TE164Digits | null;
  readonly traits: INumberTraits | null;
  readonly networkName: TNormalizedName | null;
  readonly contact: ICallerContact | null;
}
