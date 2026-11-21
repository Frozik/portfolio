import type { Brand } from '@frozik/utils/types/base';
import type { Temporal } from 'temporal-polyfill';

import type { NumberMask } from '../../masks/domain/number-mask';
import type { TE164Digits } from '../../phone/domain/caller';
import type { TGroupId } from './group';

export type TMemberId = Brand<string, 'MemberId'>;

/** Callers the number alone says something about, needing no mask. */
export type TSpecialMask = 'hidden' | 'foreign' | 'premium-rate' | 'voip' | 'toll-free';

export const SPECIAL_MASKS = [
  'hidden',
  'foreign',
  'premium-rate',
  'voip',
  'toll-free',
] as const satisfies readonly TSpecialMask[];

interface IMemberCore {
  readonly id: TMemberId;
  readonly updatedAt: Temporal.Instant;
  /**
   * The group a caller went to when the app put this exclusion here by itself (a move, a
   * contact added to «Family»): taking the caller out of that group takes it away again.
   * `null` for what the user wrote.
   */
  readonly excludedFor: TGroupId | null;
}

export interface INumberMaskMember extends IMemberCore {
  readonly kind: 'number-mask';
  readonly mask: NumberMask;
  readonly note: string;
}

export interface ISpecialMember extends IMemberCore {
  readonly kind: 'special';
  readonly special: TSpecialMask;
}

/** A person picked from the address book, with the numbers they had then (another phone has other ids). */
export interface IContactMember extends IMemberCore {
  readonly kind: 'contact';
  readonly displayName: string;
  readonly numbers: readonly TE164Digits[];
  readonly lookupKey: string | null;
}

export type TMember = INumberMaskMember | ISpecialMember | IContactMember;
