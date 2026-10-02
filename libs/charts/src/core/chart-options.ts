import type { IChartTheme } from './frame/theme';
import type { IChartExtension } from './kernel/extension';
import type { ISeries } from './series/series';
import type { IAxisDomain, IValueRange } from './viewport/axis-domain';

export type TAnyExtension<TX> = IChartExtension<TX, string, unknown>;

export interface IChartOptions<TX, TExtensions extends readonly TAnyExtension<TX>[]> {
  readonly id?: string;
  readonly x: { readonly domain: IAxisDomain<TX>; readonly start: TX; readonly end: TX };
  /** The value range before any data arrives and when nothing fits it to the data. */
  readonly y?: IValueRange;
  /** Bottom first: the order of the list is the order the series are drawn in. */
  readonly series: readonly ISeries<TX>[];
  readonly extensions: TExtensions;
  readonly theme?: IChartTheme;
}
