import type { IMaskPattern } from '@frozik/components/components/RichEditor/masked-input';

import { detectCardNetwork } from '../../model/card-network';

const DIGIT = /^\d$/;
const NON_DIGIT = /\D/g;
/** ISO/IEC 7812 allows up to 19 digits; an unknown network gets the most. */
const MAX_CARD_DIGITS = 19;
const DEFAULT_GAPS = [4, 8, 12] as const;

/** The card number's groups and length follow its network as it is typed. */
export function cardNumberMask(value: string): IMaskPattern {
  const network = detectCardNetwork(value.replace(NON_DIGIT, ''));
  return {
    accepts: character => DIGIT.test(character),
    maxLength: Math.max(...(network?.lengths ?? [MAX_CARD_DIGITS])),
    gaps: network?.gaps ?? DEFAULT_GAPS,
  };
}
