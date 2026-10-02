import { TICKS_EXTENSION } from '../../core/frame/ticks';
import { defineExtension } from '../../core/kernel/define-extension';
import type { IChartExtension } from '../../core/kernel/extension';

/** The axis lines and the tick labels; everything it draws comes from the ticks, so the headless part is only a name and a requirement. */
export function axesCore<TX>(): IChartExtension<TX, 'axes', undefined> {
  return defineExtension<TX, 'axes'>('axes', {}, [TICKS_EXTENSION]);
}
