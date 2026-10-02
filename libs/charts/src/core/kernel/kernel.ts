import type { EventBus } from '@frozik/utils/events/event-bus';

import type { IChartFrame } from '../frame/chart-frame';
import type { FrameDemand } from '../frame/frame-demand';
import type { IChartTheme } from '../frame/theme';
import type { IChartSize } from '../host/size-source';
import type { ScaleSet } from '../scale/scale-set';
import type { IAxisDomain, IAxisRange } from '../viewport/axis-domain';
import type { Viewport } from '../viewport/viewport';
import type { IChartEvents } from './events';
import type { SeriesModel } from './series-model';

/** What every extension sees of the chart: the model and the bus, nothing about other extensions but their slices. */
export interface IChartKernel<TX> {
  readonly id: string | undefined;
  readonly domain: IAxisDomain<TX>;
  readonly viewport: Viewport<TX>;
  /** The value scales and their ranges. */
  readonly scales: ScaleSet;
  readonly series: SeriesModel<TX>;
  readonly events: EventBus<IChartEvents<TX>>;
  readonly frames: FrameDemand;
  readonly theme: IChartTheme;
  /** The size measured for the last frame; none before the chart is mounted. */
  readonly size: IChartSize | undefined;
  /** The last frame built; none while there is nothing to draw. */
  readonly frame: IChartFrame<TX> | undefined;
  /** The known ends of the data of every series together. */
  readonly dataExtent: Partial<IAxisRange<TX>>;
  extension<TSlice>(id: string): TSlice | undefined;
}
