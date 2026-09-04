import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import { Fail } from '@frozik/utils/value-descriptors/fails/fail';
import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import { isNil } from 'lodash-es';

import type { InstrumentSymbol } from '../domain/instruments';
import type {
  IInstrumentCatalog,
  IInstrumentListing,
  InstrumentLookup,
} from '../domain/ports/instrument-catalog';

const TRADING_STATUS = 'TRADING';
const PRICE_FILTER_TYPE = 'PRICE_FILTER';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && !isNil(value) && !Array.isArray(value);
}

function parsePositiveNumber(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Tick size of the symbol's price filter, or `undefined` when the symbol is not trading. */
export function parseExchangeInfoTickSize(raw: unknown): number | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.symbols)) {
    return undefined;
  }
  const symbol: unknown = raw.symbols[0];
  if (!isRecord(symbol) || symbol.status !== TRADING_STATUS || !Array.isArray(symbol.filters)) {
    return undefined;
  }
  const priceFilter = symbol.filters.find(
    (filter: unknown) => isRecord(filter) && filter.filterType === PRICE_FILTER_TYPE
  );
  return isRecord(priceFilter) ? parsePositiveNumber(priceFilter.tickSize) : undefined;
}

/** Last price of `symbol` in the full `ticker/price` list, or `undefined` when it is not listed. */
export function findTickerPrice(raw: unknown, symbol: InstrumentSymbol): number | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const ticker = raw.find((entry: unknown) => isRecord(entry) && entry.symbol === symbol);
  return isRecord(ticker) ? parsePositiveNumber(ticker.price) : undefined;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance responded ${response.status} for ${url}`);
  }
  return response.json();
}

function malformed(symbol: InstrumentSymbol, what: string): InstrumentLookup {
  return {
    kind: 'failed',
    reason: Fail(EValueDescriptorErrorCode.INTERNAL, {
      message: `Binance ${what} response for ${symbol} is malformed`,
    }),
  };
}

/**
 * Resolves a symbol through the Binance spot REST API. Existence is checked
 * against the full `ticker/price` list rather than `exchangeInfo?symbol=`:
 * Binance answers an unknown symbol with a 400 that carries no CORS headers,
 * which the browser reports as a generic network failure. Only a listed
 * symbol is then asked for its tick size.
 */
export function createBinanceInstrumentCatalog(apiHost: string): IInstrumentCatalog {
  return {
    async lookup(symbol: InstrumentSymbol): Promise<InstrumentLookup> {
      try {
        const lastPrice = findTickerPrice(await fetchJson(`${apiHost}/ticker/price`), symbol);
        if (isNil(lastPrice)) {
          return { kind: 'unknown' };
        }

        const tickSize = parseExchangeInfoTickSize(
          await fetchJson(`${apiHost}/exchangeInfo?symbol=${symbol}&showPermissionSets=false`)
        );
        if (isNil(tickSize)) {
          return malformed(symbol, 'exchangeInfo');
        }

        const listing: IInstrumentListing = { tickSize, lastPrice };
        return { kind: 'listed', listing };
      } catch (error) {
        return { kind: 'failed', reason: toFail(error) };
      }
    },
  };
}
