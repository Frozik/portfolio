import { isNil } from 'lodash-es';

import type {
  INumberingMask,
  TNumberingCountry,
  TNumberingOperator,
  TNumberingService,
} from './gen/numbering-codes';
import { maskDigits } from './numbering-lookup';

export type TNumberingStateCode = NonNullable<INumberingMask['stateCodes']>[number];

/** What a number says about itself: where it is from and whose network, as far as the catalogue knows. */
export interface INumberingDetails {
  readonly country: TNumberingCountry | null;
  /** The regions its range covers; a range spanning many is no answer to «where from». */
  readonly states: readonly TNumberingStateCode[];
  readonly operator: TNumberingOperator | null;
  /**
   * The digits of the range that names the operator, the number's pool: `7986` for +7 986…;
   * `null` when no range names one.
   */
  readonly operatorPool: string | null;
  readonly service: TNumberingService | null;
}

const NOTHING_KNOWN: INumberingDetails = {
  country: null,
  states: [],
  operator: null,
  operatorPool: null,
  service: null,
};

/** The details along a number's masks, each deeper mask refining what its parent said. */
export function numberingDetailsOf(path: readonly INumberingMask[]): INumberingDetails | null {
  if (path.length === 0) {
    return null;
  }
  return path.reduce<INumberingDetails>(
    (known, node) => ({
      country: node.countryCode ?? known.country,
      states: node.stateCodes ?? known.states,
      operator: node.networkOperatorCode ?? known.operator,
      operatorPool: isNil(node.networkOperatorCode) ? known.operatorPool : maskDigits(node.mask),
      service: node.serviceCode ?? known.service,
    }),
    NOTHING_KNOWN
  );
}
