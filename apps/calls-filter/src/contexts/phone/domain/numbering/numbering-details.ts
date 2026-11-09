import type {
  INumberingMask,
  TNumberingCountry,
  TNumberingOperator,
  TNumberingService,
} from './gen/numbering-codes';

export type TNumberingStateCode = NonNullable<INumberingMask['stateCodes']>[number];

/** What a number says about itself: where it is from and whose network, as far as the catalogue knows. */
export interface INumberingDetails {
  readonly country: TNumberingCountry | null;
  /** The regions its range covers; a range spanning many is no answer to «where from». */
  readonly states: readonly TNumberingStateCode[];
  readonly operator: TNumberingOperator | null;
  readonly service: TNumberingService | null;
}

const NOTHING_KNOWN: INumberingDetails = {
  country: null,
  states: [],
  operator: null,
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
      service: node.serviceCode ?? known.service,
    }),
    NOTHING_KNOWN
  );
}
