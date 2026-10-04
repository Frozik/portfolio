import type { IAccount, IDesk, INewsItem, IPosition } from './desk';

/** Deterministic 32-bit generator (mulberry32): the desk looks the same on every visit, so a report is reproducible. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const ACCOUNTS: readonly Pick<IAccount, 'name' | 'currency'>[] = [
  { name: 'Operating', currency: 'USD' },
  { name: 'Treasury reserve', currency: 'EUR' },
  { name: 'Margin', currency: 'USD' },
];
const INSTRUMENTS: readonly string[] = [
  'AAPL',
  'MSFT',
  'NVDA',
  'TSLA',
  'AMZN',
  'META',
  'BTC-USD',
  'ETH-USD',
];
const NEWS: readonly Pick<INewsItem, 'source' | 'title'>[] = [
  { source: 'Reuters', title: 'Fed holds rates steady, signals patience on cuts' },
  { source: 'Bloomberg', title: 'Chipmakers rally as data-centre orders beat forecasts' },
  { source: 'FT', title: 'Euro area inflation eases to 2.1% in September' },
  { source: 'WSJ', title: 'Treasury yields slip ahead of jobs report' },
  { source: 'CNBC', title: 'Bitcoin steadies above key support after volatile week' },
];

const BALANCE_RANGE = 2_000_000;
const QUANTITY_RANGE = 400;
const PRICE_RANGE = 500;
const PRICE_DRIFT = 0.08;
const EQUITY_POINTS = 48;
const EQUITY_STEP = 0.02;
const IBAN_DIGITS = 16;
const NEWS_MINUTES_SPREAD = 90;
const CENTS = 100;

export function generateDesk(seed: number): IDesk {
  const random = seededRandom(seed);
  const accounts = ACCOUNTS.map((account, index) => ({
    ...account,
    id: `account-${index + 1}`,
    iban: `DE${digits(random, IBAN_DIGITS)}`,
    balance: round(random() * BALANCE_RANGE),
  }));
  const positions: IPosition[] = INSTRUMENTS.map((instrument, index) => {
    const averagePrice = round(1 + random() * PRICE_RANGE);
    return {
      id: `position-${index + 1}`,
      instrument,
      side: random() > 0.3 ? 'long' : 'short',
      quantity: 1 + Math.floor(random() * QUANTITY_RANGE),
      averagePrice,
      lastPrice: round(averagePrice * (1 + (random() - 0.5) * PRICE_DRIFT)),
    };
  });
  let equity = 1;
  const equityCurve = Array.from({ length: EQUITY_POINTS }, () => {
    equity *= 1 + (random() - 0.5) * EQUITY_STEP;
    return equity;
  });
  const news = NEWS.map((item, index) => ({
    ...item,
    id: `news-${index + 1}`,
    minutesAgo: Math.floor(random() * NEWS_MINUTES_SPREAD),
  })).sort((left, right) => left.minutesAgo - right.minutesAgo);
  return { accounts, positions, equityCurve, news };
}

function digits(random: () => number, count: number): string {
  return Array.from({ length: count }, () => Math.floor(random() * 10)).join('');
}

function round(value: number): number {
  return Math.round(value * CENTS) / CENTS;
}
