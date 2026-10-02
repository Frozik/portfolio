export type TShape = 'point' | 'candle';

export interface IPoint<TX = bigint> {
  readonly x: TX;
  /** `NaN` marks a gap: no data at this position (§4.2). */
  readonly value: number;
}

export interface ICandle<TX = bigint> {
  /** Start of the interval; the candle covers [x, x + scale). */
  readonly x: TX;
  readonly open: number;
  readonly min: number;
  readonly max: number;
  readonly close: number;
}

export interface IPointColumns<TX = bigint> {
  readonly x: ArrayLike<TX>;
  readonly value: Float64Array;
}

export interface ICandleColumns<TX = bigint> {
  readonly x: ArrayLike<TX>;
  readonly open: Float64Array;
  readonly min: Float64Array;
  readonly max: Float64Array;
  readonly close: Float64Array;
}

export interface IPointBatch<TX = bigint> {
  readonly shape: 'point';
  readonly points: readonly IPoint<TX>[] | IPointColumns<TX>;
}

export interface ICandleBatch<TX = bigint> {
  readonly shape: 'candle';
  readonly candles: readonly ICandle<TX>[] | ICandleColumns<TX>;
}

/** What a source answers with: elements of one shape, as objects or as columns. */
export type TBatch<TX = bigint> = IPointBatch<TX> | ICandleBatch<TX>;
