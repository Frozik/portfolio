import creditCardType from 'credit-card-type';
import { isNil, omit } from 'lodash-es';

/** The networks credit-card-type knows, and the national ones it leaves out; logos are drawn per network. */
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
  | 'verve'
  | 'belkart';

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
  /** Whether its numbers end in a Luhn check digit: UnionPay issues cards without one. */
  readonly checksLuhn: boolean;
}

function isCardNetwork(type: string): type is TCardNetwork {
  return NETWORKS.has(type);
}

const WITHOUT_LUHN: ReadonlySet<TCardNetwork> = new Set<TCardNetwork>(['unionpay']);

/** National networks credit-card-type leaves out, by the prefix every card of theirs starts with. */
const NATIONAL_NETWORKS: readonly (ICardNetworkInfo & { readonly prefix: string })[] = [
  {
    network: 'belkart',
    prefix: '9112',
    lengths: [16],
    gaps: [4, 8, 12],
    securityCodeLength: 3,
    checksLuhn: true,
  },
];

/** A thin wrapper over Braintree's credit-card-type — its prefix tables, not ours — after the national networks it leaves out. */
export function detectCardNetwork(digits: string): ICardNetworkInfo | null {
  const national = NATIONAL_NETWORKS.find(({ prefix }) => digits.startsWith(prefix));
  if (!isNil(national)) {
    return omit(national, 'prefix');
  }
  const [best] = creditCardType(digits);
  if (isNil(best) || !isCardNetwork(best.type)) {
    return null;
  }
  return {
    network: best.type,
    lengths: best.lengths,
    gaps: best.gaps,
    securityCodeLength: best.code.size,
    checksLuhn: !WITHOUT_LUHN.has(best.type),
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
