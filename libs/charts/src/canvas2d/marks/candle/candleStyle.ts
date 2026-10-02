import type { IStyleProcessor } from '../../../core/series/style-processor';
import type { ICandleStyleOptions } from '../../../marks/candle/style';
import { createCandleStyle } from '../../../marks/candle/style';
import { candle } from './candle';

/** Candles with a body and a wick; always asks for candle data, drawn on the 2D canvas (§6.7). */
export function candleStyle<TX>(options: ICandleStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createCandleStyle(candle, options);
}
