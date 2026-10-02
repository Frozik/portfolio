import { isNil } from 'lodash-es';
import { ACTIVE_FPS } from '../../core/frame/frame-demand';

import type { IChartFrame } from '../../core/frame/chart-frame';
import { requiredTicks } from '../../core/frame/required-ticks';
import { TICKS_EXTENSION } from '../../core/frame/ticks';
import type { IPointerInput } from '../../core/host/pointer-source';
import type { IChartExtension } from '../../core/kernel/extension';
import { pixelToValue, pixelToX } from '../../core/viewport/plot-mapping';
import type { IHoldPosition } from './touch-hold';
import { TouchHold } from './touch-hold';

/** Above the gestures that pan: a held finger's moves belong to the crosshair. */
const POINTER_PRIORITY = 10;
const LINE_THICKNESS = 1;
const CENTER_THICKNESS_RATIO = 3;
const CENTER_ARM_LENGTH = 10;
const DASH_LENGTH = 4;

/** Everything is in device pixels, measured from the top-left corner of the canvas. */
export interface ICrosshair<TX> {
  /** Left edge of the vertical line and top edge of the horizontal one. */
  readonly lineLeft: number;
  readonly lineTop: number;
  readonly thickness: number;
  /** The lines are this thick for `centerArmLength` to each side of where they cross. */
  readonly centerThickness: number;
  readonly centerArmLength: number;
  readonly dashLength: number;
  readonly x: TX;
  readonly value: number;
  readonly xLabel: string;
  readonly valueLabel: string;
}

export interface ICrosshairSlice<TX> {
  /** Where the pointer is over the chart, CSS pixels; none while it is away or a finger only pans. */
  readonly position: IHoldPosition | undefined;
  /** The crosshair under the pointer, or none while the pointer is outside the plot. */
  crosshairOf(frame: IChartFrame<TX>): ICrosshair<TX> | undefined;
  /** The position and value under the pointer, in the last frame drawn. */
  readonly point: { readonly x: TX; readonly value: number } | undefined;
}

/**
 * Follows a mouse or a pen. A finger pans and pinches, so it drives the
 * crosshair only after resting for a moment, and until it lifts (§7.1).
 */
export function crosshairCore<TX>(): IChartExtension<TX, 'crosshair', ICrosshairSlice<TX>> {
  return {
    id: 'crosshair',
    requires: [TICKS_EXTENSION],
    create(kernel) {
      const ticks = requiredTicks(kernel);
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
        const lineLeft = Math.floor(pixelX);
        const lineTop = Math.floor(pixelY);
        const x = pixelToX(frame, lineLeft + thickness / 2);
        const value = pixelToValue(frame, lineTop + thickness / 2);
        return {
          lineLeft,
          lineTop,
          thickness,
          centerThickness: thickness * CENTER_THICKNESS_RATIO,
          centerArmLength: Math.round(CENTER_ARM_LENGTH * size.devicePixelRatio),
          dashLength: Math.round(DASH_LENGTH * size.devicePixelRatio),
          x,
          value,
          xLabel: ticks.formatX(frame, x),
          valueLabel: ticks.formatY(frame, value),
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
