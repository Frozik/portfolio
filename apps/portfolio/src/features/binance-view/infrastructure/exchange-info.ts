import { isNil } from 'lodash-es';

interface IRawPriceFilter {
  readonly filterType: 'PRICE_FILTER';
  readonly tickSize: string;
}

interface IRawSymbolFilter {
  readonly filterType: string;
  readonly tickSize?: string;
}

interface IRawSymbolEntry {
  readonly symbol: string;
  readonly filters: ReadonlyArray<IRawSymbolFilter>;
}

interface IRawExchangeInfo {
  readonly symbols: ReadonlyArray<IRawSymbolEntry>;
}

function isPriceFilter(filter: IRawSymbolFilter): filter is IRawPriceFilter {
  return filter.filterType === 'PRICE_FILTER' && !isNil(filter.tickSize);
}

/**
 * Fetch `tickSize` for an instrument from Binance exchangeInfo.
 *
 * Returns `undefined` if the instrument is missing, the request fails,
 * or the response does not contain a `PRICE_FILTER`.
 */
export async function fetchPriceStep(
  apiHost: string,
  instrument: string
): Promise<number | undefined> {
  const url = `${apiHost}/exchangeInfo?symbol=${instrument.toUpperCase()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // biome-ignore lint/suspicious/noConsole: surfaces exchangeInfo REST failure → fallback tickSize used
      console.warn('binance-view: exchangeInfo request failed', {
        status: response.status,
        instrument,
      });
      return undefined;
    }

    const payload = (await response.json()) as IRawExchangeInfo;
    const symbol = payload.symbols.find(entry => entry.symbol === instrument.toUpperCase());
    if (isNil(symbol)) {
      return undefined;
    }

    const priceFilter = symbol.filters.find(isPriceFilter);
    if (isNil(priceFilter)) {
      return undefined;
    }

    const tickSize = Number.parseFloat(priceFilter.tickSize);
    return Number.isFinite(tickSize) && tickSize > 0 ? tickSize : undefined;
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: surfaces exchangeInfo network failure → fallback tickSize used
    console.warn('binance-view: exchangeInfo request errored', { instrument, error });
    return undefined;
  }
}
