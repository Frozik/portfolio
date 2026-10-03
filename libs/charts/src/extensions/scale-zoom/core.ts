import { isNil } from 'lodash-es';

import type { IPointerInput, IWheelInput } from '../../core/host/pointer-source';
import type { IChartExtension } from '../../core/kernel/extension';
import type { IPaneFrame, IScaleFrame } from '../../core/scale/scale';
import { pixelToValue, toAxis } from '../../core/scale/scale-mapping';
import { containsPixel, scaleStripOf } from '../../core/scale/scale-strip';
import type { IAxisRange } from '../../core/viewport/axis-domain';
import { DoubleTap } from './double-tap';
import { pinched, shifted, stretched } from './range-moves';

const WHEEL_ZOOM_IN = 0.7;
const WHEEL_ZOOM_OUT = 1.3;
/** Dragging a scale down over the whole height of its pane doubles its range; up, halves it. */
const DRAG_DOUBLING = 2;
/** A notch of the wheel with Shift held moves a scale this share of its height. */
const WHEEL_SHIFT_SHARE = 0.1;
const CURSOR = 'ns-resize';
/** Above the gestures of the plot: a pointer on a scale is not a pan. */
const INPUT_PRIORITY = 1;

interface IPixelPoint {
  readonly x: number;
  readonly y: number;
}

/** Where the pointer is in device pixels, and what a CSS pixel is worth there. */
interface IDevicePoint {
  readonly at: IPixelPoint;
  readonly devicePixelRatio: number;
}

/** A drag on the strip of a scale: stretches that scale about its middle. */
interface IStretch {
  readonly kind: 'stretch';
  readonly pointerId: number;
  readonly scale: IScaleFrame;
  readonly startY: number;
  readonly startRange: IAxisRange<number>;
  /** The height of the pane, CSS pixels: what the drag is measured against. */
  readonly heightPx: number;
}

/** A drag with Shift held: moves the scales with the pointer — every scale of the pane on its plot, one scale on its strip — and nothing along X. */
interface IShift {
  readonly kind: 'shift';
  readonly pointerId: number;
  /** The scales as they were when the drag began, device pixels. */
  readonly scales: readonly IScaleFrame[];
  readonly startY: number;
}

/** Two fingers on the plot of a pane: their middle moves every scale of the pane, their separation stretches it. */
interface IPinch {
  readonly kind: 'pinch';
  readonly pointerIds: readonly [number, number];
  readonly scales: readonly IScaleFrame[];
  /** Where the fingers went down, device pixels. */
  readonly from: readonly [number, number];
  to: [number, number];
}

/** A finger resting on the plot without a gesture of its own: the first half of a pinch. */
interface IResting {
  readonly pane: IPaneFrame;
  readonly y: number;
}

/**
 * The pointer works on the value scales. On the strip of a scale a drag
 * stretches that scale about its middle and the wheel about the value under
 * the pointer, and with Shift held both move it instead; on the plot a drag with Shift held moves every scale of the
 * pane up and down and the wheel with Shift held stretches them about the
 * value under the pointer — without Shift a drag is the pan along X, however
 * much it strays vertically, and the wheel zooms it — and two fingers move and stretch them together,
 * while the X axis follows the same fingers sideways. A scale touched this
 * way keeps its range however the chart moves along X, until a double tap:
 * on a scale it gives that scale back to the autoscale, on the plot every
 * scale of the pane.
 */
export function scaleZoom<TX>(): IChartExtension<TX, 'scaleZoom', undefined> {
  return {
    id: 'scaleZoom',
    create(kernel) {
      const { viewport } = kernel;
      let gesture: IStretch | IShift | IPinch | undefined;
      const resting = new Map<number, IResting>();
      const doubleTap = new DoubleTap();

      const toDevice = (input: IPixelPoint): IDevicePoint | undefined => {
        const { frame } = kernel;
        if (isNil(frame)) {
          return undefined;
        }
        const { devicePixelRatio } = frame.size;
        return {
          at: { x: input.x * devicePixelRatio, y: input.y * devicePixelRatio },
          devicePixelRatio,
        };
      };

      const scaleAt = (at: IPixelPoint): IScaleFrame | undefined => {
        const { frame } = kernel;
        return frame?.panes
          .flatMap(pane => pane.scales)
          .find(scale => scale.visible && containsPixel(scaleStripOf(frame, scale), at.x, at.y));
      };

      const paneAt = (at: IPixelPoint): IPaneFrame | undefined =>
        kernel.frame?.panes.find(pane => containsPixel(pane.plot, at.x, at.y));

      const hold = (scaleId: string, range: IAxisRange<number> | undefined): void => {
        if (!isNil(range)) {
          viewport.scale(scaleId).hold(range);
        }
      };

      const release = (released: readonly IScaleFrame[]): void => {
        for (const scale of released) {
          viewport.scale(scale.id).release();
        }
      };

      /** A second finger on the same pane makes a pinch of the two; the gesture of one finger, if any, ends. */
      const rest = (pointerId: number, pane: IPaneFrame, y: number): void => {
        const other = [...resting].find(([, each]) => each.pane.id === pane.id);
        resting.set(pointerId, { pane, y });
        if (isNil(other)) {
          return;
        }
        const [otherId, { y: otherY }] = other;
        gesture = {
          kind: 'pinch',
          pointerIds: [otherId, pointerId],
          scales: pane.scales,
          from: [otherY, y],
          to: [otherY, y],
        };
      };

      const begin = (input: IPointerInput): boolean | void => {
        const located = toDevice(input);
        if (isNil(located)) {
          return;
        }
        const { at, devicePixelRatio } = located;
        const scale = scaleAt(at);
        const pane = paneAt(at);
        if (!isNil(gesture) && gesture.kind !== 'shift') {
          return;
        }
        if (isNil(gesture) && doubleTap.press(input)) {
          release(isNil(scale) ? (pane?.scales ?? []) : [scale]);
          return true;
        }
        if (!isNil(scale) && isNil(gesture)) {
          if (input.shiftKey) {
            gesture = { kind: 'shift', pointerId: input.pointerId, scales: [scale], startY: at.y };
            return true;
          }
          gesture = {
            kind: 'stretch',
            pointerId: input.pointerId,
            scale,
            startY: input.y,
            startRange: viewport.scale(scale.id).current,
            heightPx: scale.plot.height / devicePixelRatio,
          };
          return true;
        }
        if (isNil(pane)) {
          return;
        }
        if (input.shiftKey && isNil(gesture)) {
          gesture = {
            kind: 'shift',
            pointerId: input.pointerId,
            scales: pane.scales,
            startY: at.y,
          };
          return true;
        }
        rest(input.pointerId, pane, at.y);
      };

      const stretchTo = ({ scale, startY, startRange, heightPx }: IStretch, y: number): void => {
        const factor = DRAG_DOUBLING ** ((y - startY) / heightPx);
        const middle =
          (toAxis(scale.kind, startRange.start) + toAxis(scale.kind, startRange.end)) / 2;
        hold(scale.id, stretched(scale, startRange, factor, middle));
      };

      const shiftTo = (shift: IShift, y: number): void => {
        for (const scale of shift.scales) {
          hold(scale.id, shifted(scale, shift.startY, y));
        }
      };

      const pinchTo = (pinch: IPinch, pointerId: number, y: number): void => {
        const finger = pinch.pointerIds.indexOf(pointerId);
        if (finger < 0) {
          return;
        }
        pinch.to[finger] = y;
        for (const scale of pinch.scales) {
          hold(scale.id, pinched(scale, pinch.from, pinch.to));
        }
      };

      const move = (
        input: IPointerInput,
        setCursor: (cursor: string | undefined) => void
      ): boolean | void => {
        const located = toDevice(input);
        if (isNil(located)) {
          return;
        }
        const { at } = located;
        if (isNil(gesture)) {
          setCursor(isNil(scaleAt(at)) ? undefined : CURSOR);
          return;
        }
        if (gesture.kind === 'pinch') {
          pinchTo(gesture, input.pointerId, at.y);
          return;
        }
        if (gesture.pointerId !== input.pointerId) {
          return;
        }
        if (gesture.kind === 'stretch') {
          stretchTo(gesture, input.y);
        } else {
          shiftTo(gesture, at.y);
        }
        return true;
      };

      const end = (input: IPointerInput): boolean | void => {
        resting.delete(input.pointerId);
        if (isNil(gesture)) {
          return;
        }
        if (gesture.kind === 'pinch') {
          if (gesture.pointerIds.includes(input.pointerId)) {
            gesture = undefined;
          }
          return;
        }
        if (gesture.pointerId !== input.pointerId) {
          return;
        }
        gesture = undefined;
        return true;
      };

      const onPointer = (
        input: IPointerInput,
        setCursor: (cursor: string | undefined) => void
      ): boolean | void => {
        switch (input.phase) {
          case 'down':
            return begin(input);
          case 'move':
            return move(input, setCursor);
          case 'up':
          case 'cancel':
            return end(input);
          case 'leave':
            setCursor(undefined);
            return;
        }
      };

      /** A turn of the wheel stretches the scales given about the value each has under the pointer. */
      const turn = (
        turned: readonly IScaleFrame[],
        input: IWheelInput,
        y: number
      ): boolean | void => {
        if (turned.length === 0) {
          return;
        }
        const factor = input.deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN;
        for (const scale of turned) {
          const anchor = toAxis(scale.kind, pixelToValue(scale, y));
          hold(scale.id, stretched(scale, viewport.scale(scale.id).current, factor, anchor));
        }
        return true;
      };

      /** A turn of the wheel on the strip of a scale with Shift held moves the scale a notch. */
      const slide = (scale: IScaleFrame, input: IWheelInput): boolean => {
        const step = Math.sign(input.deltaY) * scale.area.height * WHEEL_SHIFT_SHARE;
        hold(scale.id, shifted(scale, scale.area.top, scale.area.top + step));
        return true;
      };

      const onWheel = (input: IWheelInput): boolean | void => {
        const located = toDevice(input);
        if (isNil(located)) {
          return;
        }
        const { at } = located;
        const scale = scaleAt(at);
        if (!isNil(scale)) {
          return input.shiftKey ? slide(scale, input) : turn([scale], input, at.y);
        }
        if (input.shiftKey) {
          return turn(paneAt(at)?.scales ?? [], input, at.y);
        }
      };

      return {
        slice: undefined,
        mount(host): VoidFunction {
          const stopListening = host.pointer.subscribe(
            {
              pointer: input =>
                onPointer(input, cursor => host.pointer.setCursor(cursor, INPUT_PRIORITY)),
              wheel: onWheel,
            },
            INPUT_PRIORITY
          );
          return () => {
            stopListening();
            host.pointer.setCursor(undefined, INPUT_PRIORITY);
          };
        },
      };
    },
  };
}
