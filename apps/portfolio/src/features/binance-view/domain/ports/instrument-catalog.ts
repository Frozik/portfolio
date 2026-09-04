import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';

import type { InstrumentSymbol } from '../instruments';

/** What the exchange says about a tradable symbol. */
export interface IInstrumentListing {
  /** Exchange price increment (`PRICE_FILTER.tickSize`). */
  readonly tickSize: number;
  readonly lastPrice: number;
}

export type InstrumentLookup =
  | { readonly kind: 'listed'; readonly listing: IInstrumentListing }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'failed'; readonly reason: ValueDescriptorFail };

/** Port for asking the exchange about a symbol; `infrastructure/binance-instrument-catalog.ts` implements it. */
export interface IInstrumentCatalog {
  lookup(symbol: InstrumentSymbol): Promise<InstrumentLookup>;
}
