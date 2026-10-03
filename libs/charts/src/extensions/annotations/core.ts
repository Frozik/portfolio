import { ACTIVE_FPS } from '../../core/frame/frame-demand';
import { TICKS_EXTENSION } from '../../core/frame/ticks';
import type { IChartExtension } from '../../core/kernel/extension';
import type { TColor } from '../../core/series/color';

/** A level marked across a pane: a price, a limit, a threshold. */
export interface ILevel {
  readonly value: number;
  /** The value scale the level is measured against; the first scale of the chart when not given. */
  readonly scale?: string;
  /** What the label on the scale says; the value itself when not given. */
  readonly label?: string;
  readonly color?: TColor;
}

/** A moment marked on the X axis: an earnings report, a deployment, a trade. */
export interface IEventMark<TX> {
  /** In world coordinates: on an axis with cuts the event stands where the chart shows that moment. */
  readonly x: TX;
  /** A letter or two shown in the badge. */
  readonly label: string;
  readonly color?: TColor;
}

export interface IAnnotationsOptions<TX> {
  readonly levels?: readonly ILevel[];
  readonly events?: readonly IEventMark<TX>[];
}

export interface IAnnotationsSlice<TX> {
  readonly levels: readonly ILevel[];
  readonly events: readonly IEventMark<TX>[];
  setLevels(levels: readonly ILevel[]): void;
  setEvents(events: readonly IEventMark<TX>[]): void;
  /** Grows with every change: what is drawn depends on it as well as on the frame. */
  readonly revision: number;
}

/**
 * Marks that are not data: levels across a pane and events on the X axis.
 * They belong to the application — it sets them and changes them on a live
 * chart; they take no part in fitting the scales.
 */
export function annotationsCore<TX>(
  options: IAnnotationsOptions<TX> = {}
): IChartExtension<TX, 'annotations', IAnnotationsSlice<TX>> {
  return {
    id: 'annotations',
    requires: [TICKS_EXTENSION],
    create(kernel) {
      let levels = options.levels ?? [];
      let events = options.events ?? [];
      let revision = 0;
      const changed = (): void => {
        revision += 1;
        kernel.frames.raise(ACTIVE_FPS);
      };

      return {
        slice: {
          get levels(): readonly ILevel[] {
            return levels;
          },
          get events(): readonly IEventMark<TX>[] {
            return events;
          },
          setLevels(next): void {
            levels = next;
            changed();
          },
          setEvents(next): void {
            events = next;
            changed();
          },
          get revision(): number {
            return revision;
          },
        },
      };
    },
  };
}
