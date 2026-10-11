import creditCardType from 'credit-card-type';
import { isNil } from 'lodash-es';

/** The networks credit-card-type knows; logos are drawn per network. */
export type TCardNetwork =
  | 'visa'
  | 'mastercard'
  | 'american-express'
  | 'diners-club'
  | 'discover'
  | 'jcb'
  | 'unionpay'
  | 'maestro'
  | 'mir'
  | 'elo'
  | 'hiper'
  | 'hipercard'
  | 'troy'
  | 'naranja'
  | 'verve';

const NETWORKS: ReadonlySet<string> = new Set<TCardNetwork>([
  'visa',
  'mastercard',
  'american-express',
  'diners-club',
  'discover',
  'jcb',
  'unionpay',
  'maestro',
  'mir',
  'elo',
  'hiper',
  'hipercard',
  'troy',
  'naranja',
  'verve',
]);

export interface ICardNetworkInfo {
  readonly network: TCardNetwork;
  readonly lengths: readonly number[];
  /** Positions after which a space is shown: `4111 1111 1111 1111`. */
  readonly gaps: readonly number[];
  readonly securityCodeLength: number;
}

function isCardNetwork(type: string): type is TCardNetwork {
  return NETWORKS.has(type);
}

/** A thin wrapper over Braintree's credit-card-type: its prefix tables, not ours. */
export function detectCardNetwork(digits: string): ICardNetworkInfo | null {
  const [best] = creditCardType(digits);
  if (isNil(best) || !isCardNetwork(best.type)) {
    return null;
  }
  return {
    network: best.type,
    lengths: best.lengths,
    gaps: best.gaps,
    securityCodeLength: best.code.size,
  };
}

export function groupCardNumber(digits: string): string {
  const gaps = detectCardNetwork(digits)?.gaps ?? [4, 8, 12];
  let grouped = '';
  for (let index = 0; index < digits.length; index += 1) {
    grouped += (gaps.includes(index) ? ' ' : '') + digits[index];
  }
  return grouped;
}
