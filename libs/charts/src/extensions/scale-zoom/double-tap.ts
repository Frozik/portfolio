import { isNil } from 'lodash-es';

import type { IPointerInput } from '../../core/host/pointer-source';

const DOUBLE_TAP_MS = 350;
/** CSS pixels the second tap may land from the first. */
const DOUBLE_TAP_REACH = 24;

/** Tells a second press close in time and place to the first: a double click, or a double tap. */
export class DoubleTap {
  private last: IPointerInput | undefined;

  /** Whether this press completes a double tap; the press then counts for no further one. */
  press(input: IPointerInput): boolean {
    const { last } = this;
    this.last = input;
    if (isNil(last)) {
      return false;
    }
    const isDouble =
      input.timeStamp - last.timeStamp <= DOUBLE_TAP_MS &&
      Math.hypot(input.x - last.x, input.y - last.y) <= DOUBLE_TAP_REACH;
    if (isDouble) {
      this.last = undefined;
    }
    return isDouble;
  }
}
