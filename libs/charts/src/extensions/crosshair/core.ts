import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { ACTIVE_FPS } from '../../core/frame/frame-demand';

import type { IChartFrame } from '../../core/frame/chart-frame';
import type { ICrosshair, ICrosshairSlice, ICrosshairValue } from '../../core/frame/crosshair';
import { CROSSHAIR_EXTENSION } from '../../core/frame/crosshair';
import { requiredTicks } from '../../core/frame/required-ticks';
import { TICKS_EXTENSION } from '../../core/frame/ticks';
import type { IPointerInput } from '../../core/host/pointer-source';
import type { IChartExtension } from '../../core/kernel/extension';
import type { IPaneFrame } from '../../core/scale/scale';
import { pixelToValue } from '../../core/scale/scale-mapping';
import { nearestElement } from '../../core/series/nearest';
import { pixelToX, xToPixel } from '../../core/viewport/plot-mapping';
import type { IHoldPosition } from './touch-hold';
import { TouchHold } from './touch-hold';

/** Above the gestures that pan: a held finger's moves belong to the crosshair. */
const POINTER_PRIORITY = 10;
const LINE_THICKNESS = 1;
const CENTER_THICKNESS_RATIO = 3;
const CENTER_ARM_LENGTH = 10;
const DASH_LENGTH = 4;

export interface ICrosshairOptions {
  /**
   * The series the crosshair snaps to, by id: its vertical line stands on the
   * nearest element of any of them instead of under the pointer itself. None,
   * and it does not snap.
   */
  readonly snap?: readonly string[];
}

/** Where along X the crosshair stands: the position it reports and the pixel its line is centred on. */
interface IStand<TX> {
  readonly x: TX;
  readonly pixel: number;
}

/** The element nearest to the pointer among the series named; a candle is pointed at mid-interval, where it is drawn. */
function nearestStand<TX>(
  frame: IChartFrame<TX>,
  seriesIds: readonly string[],
  pointerPixel: number
): IStand<TX> | undefined {
  const pointed = pixelToX(frame, pointerPixel);
  let nearest: IStand<TX> | undefined;
  for (const { id, runs } of frame.series) {
    const found = seriesIds.includes(id) ? nearestElement(frame.domain, runs, pointed) : undefined;
    if (isNil(found)) {
      continue;
    }
    const { run } = found.styled;
    const x = run.x[found.index];
    const halfStep = run.shape === 'candle' ? (run.step ?? 0) / 2 : 0;
    const pixel = xToPixel(frame, x) + (halfStep / frame.xSpan) * frame.size.width;
    if (isNil(nearest) || Math.abs(pixel - pointerPixel) < Math.abs(nearest.pixel - pointerPixel)) {
      nearest = { x, pixel };
    }
  }
  return nearest;
}

/** The pane a height of the canvas falls into; between two panes, the nearer one. */
function paneAt<TX>(frame: IChartFrame<TX>, pixel: number): IPaneFrame {
  const distanceTo = ({ plot }: IPaneFrame): number =>
    pixel < plot.top ? plot.top - pixel : Math.max(0, pixel - plot.bottom);
  return frame.panes.reduce((nearest, pane) =>
    distanceTo(pane) < distanceTo(nearest) ? pane : nearest
  );
}

/**
 * Follows a mouse or a pen. A finger pans and pinches, so it drives the
 * crosshair only after resting for a moment, and until it lifts (§7.1).
 */
export function crosshairCore<TX>(
  options: ICrosshairOptions = {}
): IChartExtension<TX, typeof CROSSHAIR_EXTENSION, ICrosshairSlice<TX>> {
  const snapTo = options.snap ?? [];

  return {
    id: CROSSHAIR_EXTENSION,
    requires: [TICKS_EXTENSION],
    create(kernel) {
      const ticks = requiredTicks(kernel);
      for (const seriesId of snapTo) {
        assert(
          kernel.series.ids.includes(seriesId),
          `the crosshair snaps to the series "${seriesId}", which the chart does not have`
        );
      }
      const touches = new Set<number>();
      let position: IHoldPosition | undefined;

      const moveTo = (next: IHoldPosition | undefined): void => {
        position = next;
        kernel.frames.raise(ACTIVE_FPS);
      };
      const hold = new TouchHold(moveTo, () => moveTo(undefined));

      const onTouch = (input: IPointerInput): boolean => {
        switch (input.phase) {
          case 'down':
            touches.add(input.pointerId);
            if (touches.size === 1) {
              hold.begin(input);
            } else {
              hold.end();
            }
            return false;
          case 'move': {
            const belongsToHold = hold.move(input);
            if (hold.isHolding) {
              moveTo(input);
            }
            return belongsToHold;
          }
          case 'up':
          case 'cancel':
          case 'leave':
            touches.delete(input.pointerId);
            hold.end();
            return false;
        }
      };

      const onPointer = (input: IPointerInput): boolean => {
        if (input.kind === 'touch') {
          return onTouch(input);
        }
        moveTo(input.phase === 'leave' || input.phase === 'cancel' ? undefined : input);
        return false;
      };

      const crosshairOf = (frame: IChartFrame<TX>): ICrosshair<TX> | undefined => {
        if (isNil(position)) {
          return undefined;
        }
        const { plot, size } = frame;
        const pixelX = position.x * size.devicePixelRatio;
        const pixelY = position.y * size.devicePixelRatio;
        if (
          pixelX < plot.left ||
          pixelX > plot.right ||
          pixelY < plot.top ||
          pixelY > plot.bottom
        ) {
          return undefined;
        }
        const thickness = Math.max(1, Math.round(LINE_THICKNESS * size.devicePixelRatio));
        const snapped = nearestStand(frame, snapTo, pixelX);
        const lineLeft = isNil(snapped)
          ? Math.floor(pixelX)
          : Math.round(snapped.pixel - thickness / 2);
        const lineTop = Math.floor(pixelY);
        const x = snapped?.x ?? pixelToX(frame, lineLeft + thickness / 2);
        const height = lineTop + thickness / 2;
        const values = paneAt(frame, height).scales.map((scale): ICrosshairValue => {
          const value = pixelToValue(scale, height);
          return { scale, value, label: ticks.formatValue(frame, scale, value) };
        });
        return {
          lineLeft,
          lineTop,
          thickness,
          centerThickness: thickness * CENTER_THICKNESS_RATIO,
          centerArmLength: Math.round(CENTER_ARM_LENGTH * size.devicePixelRatio),
          dashLength: Math.round(DASH_LENGTH * size.devicePixelRatio),
          x,
          xLabel: ticks.formatX(frame, x),
          value: values[0].value,
          valueLabel: values[0].label,
          values,
        };
      };

      return {
        slice: {
          get position(): IHoldPosition | undefined {
            return position;
          },
          crosshairOf,
          get point(): { readonly x: TX; readonly value: number } | undefined {
            const crosshair = isNil(kernel.frame) ? undefined : crosshairOf(kernel.frame);
            return isNil(crosshair) ? undefined : { x: crosshair.x, value: crosshair.value };
          },
        },
        mount(host): VoidFunction {
          const unsubscribe = host.pointer.subscribe({ pointer: onPointer }, POINTER_PRIORITY);
          return () => {
            unsubscribe();
            hold.end();
            touches.clear();
            position = undefined;
          };
        },
      };
    },
  };
}
