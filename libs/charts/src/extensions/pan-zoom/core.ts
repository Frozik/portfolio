import { computePinchScale } from '@frozik/utils/webgpu/pinchScale';
import { isNil } from 'lodash-es';
import { ACTIVE_FPS } from '../../core/frame/frame-demand';

import type { IPointerInput, IWheelInput } from '../../core/host/pointer-source';
import type { IChartExtension } from '../../core/kernel/extension';
import { spanOf } from '../../core/viewport/axis-domain';

const WHEEL_ZOOM_IN = 0.7;
const WHEEL_ZOOM_OUT = 1.3;
/** Share of the velocity kept each frame while a released pan coasts. */
const INERTIA_DAMPING = 0.95;
/** A pointer that rested this long before lifting was stopped, not flicked. */
const FLICK_MAX_REST_MS = 80;
/** Pixels per millisecond below which coasting stops. */
const INERTIA_MIN_VELOCITY = 0.01;
const VELOCITY_SAMPLES = 5;
const MIN_VELOCITY_SAMPLES = 2;
const RESTING_CURSOR = 'crosshair';
const PANNING_CURSOR = 'grabbing';

interface IVelocitySample {
  readonly deltaX: number;
  readonly timeStamp: number;
}

interface ITrackedPointer {
  readonly x: number;
  readonly y: number;
}

/** How far apart two fingers are along X: the pinch of the X axis; their vertical part is for the value scales. */
function spreadOf([first, second]: readonly [ITrackedPointer, ITrackedPointer]): number {
  return Math.abs(first.x - second.x);
}

function middleOf([first, second]: readonly [ITrackedPointer, ITrackedPointer]): number {
  return (first.x + second.x) / 2;
}

/**
 * One pointer pans; two pan by their middle and zoom by how far apart they
 * are along X; the wheel zooms round the cursor. A
 * released pan keeps coasting and slows down. Zooming moves the target, so an
 * animator can ease into it; panning moves what is drawn at once (§7.1).
 */
export function panZoom<TX>(): IChartExtension<TX, 'panZoom', undefined> {
  return {
    id: 'panZoom',
    create(kernel) {
      const { domain, viewport, frames } = kernel;
      const pointers = new Map<number, ITrackedPointer>();
      const samples: IVelocitySample[] = [];
      let pinchDistance = 0;
      let velocity = 0;
      let coastedAt = 0;

      const widthPx = (): number => {
        const { size } = kernel;
        return isNil(size) ? 0 : size.width / size.devicePixelRatio;
      };

      /** Pans by pixels; returns whether the chart really moved. */
      const pan = (deltaPixels: number): boolean => {
        const width = widthPx();
        if (width === 0) {
          return false;
        }
        const unitsPerPixel = spanOf(domain, viewport.current) / width;
        return viewport.shift(-deltaPixels * unitsPerPixel) !== 0;
      };

      const zoom = (factor: number, centerPixel: number): void => {
        const width = widthPx();
        if (width === 0) {
          return;
        }
        const { target } = viewport;
        const span = spanOf(domain, target);
        const share = centerPixel / width;
        const center = domain.add(target.start, span * share);
        viewport.setTarget({
          start: domain.add(center, -span * factor * share),
          end: domain.add(center, span * factor * (1 - share)),
        });
      };

      const twoPointers = (): readonly [ITrackedPointer, ITrackedPointer] | undefined => {
        const [first, second] = pointers.values();
        return isNil(first) || isNil(second) ? undefined : [first, second];
      };

      const pinch = (previousMiddle: number): void => {
        const pair = twoPointers();
        if (isNil(pair)) {
          return;
        }
        pan(middleOf(pair) - previousMiddle);
        const spread = spreadOf(pair);
        const scale = computePinchScale(pinchDistance, spread);
        if (!isNil(scale)) {
          zoom(scale, middleOf(pair));
          pinchDistance = spread;
        }
      };

      const startCoasting = (releasedAt: number): void => {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const taken = samples.splice(0);
        if (
          taken.length < MIN_VELOCITY_SAMPLES ||
          releasedAt - last.timeStamp > FLICK_MAX_REST_MS
        ) {
          return;
        }
        const elapsed = last.timeStamp - first.timeStamp;
        if (elapsed > 0) {
          // The first sample's travel happened before its own time stamp: it is not part of `elapsed`.
          velocity = taken.slice(1).reduce((sum, sample) => sum + sample.deltaX, 0) / elapsed;
          coastedAt = releasedAt;
          frames.raise(ACTIVE_FPS);
        }
      };

      const onPointer = (input: IPointerInput, setCursor: (cursor: string) => void): void => {
        switch (input.phase) {
          case 'down': {
            pointers.set(input.pointerId, input);
            velocity = 0;
            samples.length = 0;
            if (pointers.size === 1) {
              setCursor(PANNING_CURSOR);
            } else {
              const pair = twoPointers();
              pinchDistance = isNil(pair) ? 0 : spreadOf(pair);
            }
            break;
          }
          case 'move': {
            const previous = pointers.get(input.pointerId);
            if (isNil(previous)) {
              return;
            }
            const before = twoPointers();
            pointers.set(input.pointerId, input);
            if (!isNil(before) && pointers.size === 2) {
              pinch(middleOf(before));
            } else if (pointers.size === 1) {
              const deltaX = input.x - previous.x;
              samples.push({ deltaX, timeStamp: input.timeStamp });
              if (samples.length > VELOCITY_SAMPLES) {
                samples.shift();
              }
              pan(deltaX);
            }
            break;
          }
          case 'up':
          case 'cancel': {
            if (!pointers.delete(input.pointerId) || pointers.size > 0) {
              return;
            }
            setCursor(RESTING_CURSOR);
            if (input.phase === 'up') {
              startCoasting(input.timeStamp);
            }
            break;
          }
          case 'leave':
            return;
        }
        frames.raise(ACTIVE_FPS);
      };

      const onWheel = (input: IWheelInput): void => {
        zoom(input.deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN, input.x);
        frames.raise(ACTIVE_FPS);
      };

      return {
        slice: undefined,
        tick(now): void {
          if (Math.abs(velocity) < INERTIA_MIN_VELOCITY) {
            velocity = 0;
            return;
          }
          const moved = pan(velocity * Math.max(0, now - coastedAt));
          coastedAt = now;
          velocity = moved ? velocity * INERTIA_DAMPING : 0;
          frames.raise(ACTIVE_FPS);
        },
        mount(host): VoidFunction {
          host.pointer.setCursor(RESTING_CURSOR);
          return host.pointer.subscribe({
            pointer: input => onPointer(input, cursor => host.pointer.setCursor(cursor)),
            wheel: onWheel,
          });
        },
      };
    },
  };
}
