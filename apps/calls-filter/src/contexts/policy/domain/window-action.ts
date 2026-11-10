import type { TAction } from './action';
import { oppositeOf } from './action';
import type { IPolicy } from './policy';

/**
 * What a group does while its schedule, calendars and places hold: the opposite of the rest of
 * the time, since doing the same would make them change nothing.
 */
export function windowActionOf(policy: IPolicy): TAction {
  return oppositeOf(policy.otherwise);
}
