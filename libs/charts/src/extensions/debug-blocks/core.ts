import type { IChartFrame } from '../../core/frame/chart-frame';
import { ACTIVE_FPS } from '../../core/frame/frame-demand';
import type { IPixelRect } from '../../core/frame/pixel-rect';
import type { IChartExtension } from '../../core/kernel/extension';
import { lowerBound, upperBound } from '../../core/series/search';
import type { TShape } from '../../core/series/shape';
import { xToPixel } from '../../core/viewport/plot-mapping';

const LINE_WIDTH = 2;

export interface IDebugBlocksSlice<TX> {
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
  /** Grows with every switch: the lines of a frame depend on it as well as on the frame. */
  readonly revision: number;
  /** A vertical line where every block in view begins; none while switched off. */
  linesOf(frame: IChartFrame<TX>): readonly IPixelRect[];
}

export interface IDebugBlocksOptions {
  /** How many elements of a shape a backend keeps together; without it a run is one block. */
  readonly blockSize?: (shape: TShape) => number;
}

/** Marks where the blocks a backend cuts the data into begin; off until switched on (§7.1). */
export function debugBlocksCore<TX>(
  options: IDebugBlocksOptions = {}
): IChartExtension<TX, 'debugBlocks', IDebugBlocksSlice<TX>> {
  return {
    id: 'debugBlocks',
    create(kernel) {
      let enabled = false;
      let revision = 0;

      const linesOf = (frame: IChartFrame<TX>): readonly IPixelRect[] => {
        if (!enabled) {
          return [];
        }
        const { plot, size } = frame;
        const width = Math.round(LINE_WIDTH * size.devicePixelRatio);
        const lines: IPixelRect[] = [];
        for (const series of frame.series) {
          for (const { run } of series.runs) {
            const blockSize = options.blockSize?.(run.shape) ?? run.length;
            const first = lowerBound(frame.domain, run.x, run.length, frame.x.start);
            const last = upperBound(frame.domain, run.x, run.length, frame.x.end);
            const firstBlock = Math.ceil(first / blockSize) * blockSize;
            for (let element = firstBlock; element < last; element += blockSize) {
              const pixel = xToPixel(frame, run.x[element]);
              if (pixel >= plot.left && pixel <= plot.right) {
                lines.push({
                  left: Math.round(pixel - width / 2),
                  top: plot.top,
                  width,
                  height: plot.height,
                });
              }
            }
          }
        }
        return lines;
      };

      return {
        slice: {
          get enabled(): boolean {
            return enabled;
          },
          setEnabled(next: boolean): void {
            if (next === enabled) {
              return;
            }
            enabled = next;
            revision++;
            kernel.frames.raise(ACTIVE_FPS);
          },
          get revision(): number {
            return revision;
          },
          linesOf,
        },
      };
    },
  };
}
