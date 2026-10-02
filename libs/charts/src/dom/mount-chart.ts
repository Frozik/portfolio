import type { ChartModel } from '../core/chart-model';
import type { Stage } from '../core/stage/stage';
import { createPointerSource } from './pointer-source';
import { createSizeTracker } from './size-tracker';

export interface IDomMounting {
  /** The element pointer input is taken from and the chart is sized by: the topmost canvas. */
  readonly input: HTMLElement;
  /** One canvas per backend the chart draws with, by backend id. */
  readonly canvases: Readonly<Record<string, HTMLCanvasElement>>;
}

/** Puts a chart on a stage with the browser as its host; returns the unmount. */
export function mountChart<TX>(
  stage: Stage,
  chart: ChartModel<TX>,
  mounting: IDomMounting
): VoidFunction {
  const pointer = createPointerSource(mounting.input);
  const unmount = stage.mount(chart, {
    host: { pointer, size: createSizeTracker(mounting.input) },
    canvases: mounting.canvases,
  });
  return () => {
    unmount();
    pointer.dispose();
  };
}
