import type { IStyleProcessor } from '../../core/series/style-processor';
import type { ICandleStyleOptions } from '../../marks/candle/style';
import { createCandleStyle } from '../../marks/candle/style';
import { candle } from './marks';

/** Candles with a body and a wick; always asks for candle data, on WebGPU where there is one and on the 2D canvas where there is not. */
export function candleStyle<TX>(options: ICandleStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createCandleStyle(candle, options);
}
