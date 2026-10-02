import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { ITicksSlice } from '../../core/frame/ticks';
import { TICKS_EXTENSION } from '../../core/frame/ticks';
import type { IChartKernel } from '../../core/kernel/kernel';

/** The ticks an extension declared it requires. */
export function requiredTicks<TX>(kernel: IChartKernel<TX>): ITicksSlice<TX> {
  const slice = kernel.extension<ITicksSlice<TX>>(TICKS_EXTENSION);
  assert(!isNil(slice), 'the "ticks" extension is registered before whatever draws from it');
  return slice;
}
