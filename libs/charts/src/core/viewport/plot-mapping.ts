import type { IChartFrame } from '../frame/chart-frame';

/**
 * The visible range along X is spread over the whole canvas, margins
 * included, because that is where the series shaders and the pan and zoom
 * gestures put it; the plot rectangle only clips what is drawn. Values go
 * through their scale: `core/scale/scale-mapping`.
 */
export function xToPixel<TX>(frame: IChartFrame<TX>, position: TX): number {
  return (frame.domain.diff(position, frame.x.start) / frame.xSpan) * frame.size.width;
}

export function pixelToX<TX>(frame: IChartFrame<TX>, pixel: number): TX {
  return frame.domain.add(frame.x.start, (pixel / frame.size.width) * frame.xSpan);
}
