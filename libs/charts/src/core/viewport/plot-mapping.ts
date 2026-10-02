import type { IChartFrame } from '../frame/chart-frame';

/**
 * The visible range is spread over the whole canvas, margins included,
 * because that is where the series shaders and the pan and zoom gestures put
 * it; the plot rectangle only clips what is drawn.
 */
export function xToPixel<TX>(frame: IChartFrame<TX>, position: TX): number {
  return (frame.domain.diff(position, frame.x.start) / frame.xSpan) * frame.size.width;
}

export function valueToPixel<TX>(frame: IChartFrame<TX>, value: number): number {
  const normalized = (value - frame.y.min) / (frame.y.max - frame.y.min);
  return frame.size.height - normalized * frame.size.height;
}

export function pixelToX<TX>(frame: IChartFrame<TX>, pixel: number): TX {
  return frame.domain.add(frame.x.start, (pixel / frame.size.width) * frame.xSpan);
}

export function pixelToValue<TX>(frame: IChartFrame<TX>, pixel: number): number {
  const normalized = 1 - pixel / frame.size.height;
  return frame.y.min + normalized * (frame.y.max - frame.y.min);
}
