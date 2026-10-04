export type TSide = 'long' | 'short';

export interface IAccount {
  readonly id: string;
  readonly name: string;
  readonly iban: string;
  readonly currency: string;
  readonly balance: number;
}

export interface IPosition {
  readonly id: string;
  readonly instrument: string;
  readonly side: TSide;
  readonly quantity: number;
  readonly averagePrice: number;
  readonly lastPrice: number;
}

export interface INewsItem {
  readonly id: string;
  readonly minutesAgo: number;
  readonly source: string;
  readonly title: string;
}

export interface IDesk {
  readonly accounts: readonly IAccount[];
  readonly positions: readonly IPosition[];
  readonly equityCurve: readonly number[];
  readonly news: readonly INewsItem[];
}

export function profitOf(position: IPosition): number {
  const direction = position.side === 'long' ? 1 : -1;
  return direction * (position.lastPrice - position.averagePrice) * position.quantity;
}

export function totalBalance(accounts: readonly IAccount[]): number {
  return accounts.reduce((total, account) => total + account.balance, 0);
}
