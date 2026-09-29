import { isNil } from 'lodash-es';

import { assert } from '../../../assert/assert';
import { HOURS_PER_DAY, MINUTES_PER_HOUR } from '../../constants';
import { LONGEST_MONTH, MONTHS_IN_YEAR } from '../limits';
import { ESlot } from '../slot';
import type { SlotWeights } from './weights';
import {
  CERTAIN,
  DOUBTFUL,
  EVEN,
  LIKELY,
  NO_WEIGHTS,
  PLAUSIBLE,
  PROBABLE,
  REMOTE,
  UNLIKELY,
  VERY_LIKELY,
} from './weights';

interface IMagnitude {
  readonly from: number;
  readonly weights: Partial<SlotWeights>;
}

const FOUR_DIGITS = 1000;
const THREE_DIGITS = 100;
const PAST_LAST_MINUTE = MINUTES_PER_HOUR;
const PAST_LAST_DAY = LONGEST_MONTH + 1;
const PAST_LAST_HOUR = HOURS_PER_DAY;
const PAST_LAST_MONTH = MONTHS_IN_YEAR + 1;

/** What a bare number can be, judged by its size alone; the first row it reaches applies. */
const MAGNITUDES: readonly IMagnitude[] = [
  { from: FOUR_DIGITS, weights: { [ESlot.Year]: CERTAIN } },
  { from: THREE_DIGITS, weights: { [ESlot.Millisecond]: CERTAIN } },
  { from: PAST_LAST_MINUTE, weights: { [ESlot.Year]: VERY_LIKELY } },
  {
    from: PAST_LAST_DAY,
    weights: { [ESlot.Minute]: EVEN, [ESlot.Second]: EVEN, [ESlot.Year]: REMOTE },
  },
  {
    from: PAST_LAST_HOUR,
    weights: {
      [ESlot.Day]: LIKELY,
      [ESlot.Minute]: DOUBTFUL,
      [ESlot.Second]: DOUBTFUL,
      [ESlot.Year]: UNLIKELY,
    },
  },
  {
    from: PAST_LAST_MONTH,
    weights: {
      [ESlot.Hour]: PROBABLE,
      [ESlot.Day]: EVEN,
      [ESlot.Minute]: DOUBTFUL,
      [ESlot.Second]: DOUBTFUL,
      [ESlot.Year]: REMOTE,
    },
  },
  {
    from: 1,
    weights: {
      [ESlot.Hour]: PLAUSIBLE,
      [ESlot.Month]: EVEN,
      [ESlot.Day]: EVEN,
      [ESlot.Minute]: DOUBTFUL,
      [ESlot.Second]: DOUBTFUL,
      [ESlot.Year]: REMOTE,
    },
  },
  {
    from: 0,
    weights: {
      [ESlot.Minute]: PROBABLE,
      [ESlot.Second]: PROBABLE,
      [ESlot.Hour]: EVEN,
      [ESlot.Year]: REMOTE,
    },
  },
];

export function plausibilityOf(value: number): SlotWeights {
  const magnitude = MAGNITUDES.find(({ from }) => value >= from);
  assert(!isNil(magnitude), `no magnitude covers ${value}`);

  return { ...NO_WEIGHTS, ...magnitude.weights };
}
