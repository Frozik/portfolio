import type { IPaintContribution } from '../stage/backend';
import type { IChartExtension } from './extension';
import type { IChartKernel } from './kernel';

/**
 * The same extension with something to draw: how a backend attaches its
 * painter to a headless extension without the extension knowing the backend (§6.2).
 */
export function withPaint<TX, TId extends string, TSlice>(
  extension: IChartExtension<TX, TId, TSlice>,
  paint: (slice: TSlice, kernel: IChartKernel<TX>) => readonly IPaintContribution[]
): IChartExtension<TX, TId, TSlice> {
  return {
    ...extension,
    create(kernel) {
      const instance = extension.create(kernel);
      return { ...instance, paint: [...(instance.paint ?? []), ...paint(instance.slice, kernel)] };
    },
  };
}
