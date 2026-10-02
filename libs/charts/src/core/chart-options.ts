import type { IChartTheme } from './frame/theme';
import type { IChartExtension } from './kernel/extension';
import type { IPaneOptions, IScaleOptions } from './scale/scale';
import type { ISeries } from './series/series';
import type { IAxisDomain, IValueRange } from './viewport/axis-domain';

export type TAnyExtension<TX> = IChartExtension<TX, string, unknown>;

export interface IChartOptions<TX, TExtensions extends readonly TAnyExtension<TX>[]> {
  readonly id?: string;
  readonly x: { readonly domain: IAxisDomain<TX>; readonly start: TX; readonly end: TX };
  /** The range of the first value scale before any data arrives and when nothing fits it to the data. */
  readonly y?: IValueRange;
  /** The panes top to bottom; one when not given. */
  readonly panes?: readonly IPaneOptions[];
  /** The value scales; one on the left of the first pane when not given. A series is measured against the first unless it names another. */
  readonly scales?: readonly IScaleOptions[];
  /** Bottom first: the order of the list is the order the series are drawn in. */
  readonly series: readonly ISeries<TX>[];
  readonly extensions: TExtensions;
  readonly theme?: IChartTheme;
}
