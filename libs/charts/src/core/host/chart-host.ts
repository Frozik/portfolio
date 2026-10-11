import type { IPointerSource } from './pointer-source';
import type { ISizeSource } from './size-source';

/** What a mounted chart gets from the place it is mounted in. */
export interface IChartHost {
  readonly pointer: IPointerSource;
  readonly size: ISizeSource;
}
