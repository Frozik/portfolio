import type { Temporal } from 'temporal-polyfill';

import type { TGroup } from '../../grouping/domain/group';
import type { GroupBook } from '../../grouping/domain/group-book';
import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import { membership } from '../../grouping/domain/membership';
import type { ICaller } from '../../phone/domain/caller';
import type { TRepeatPass } from '../../policy/domain/repeat-pass';
import { isRepeatPassOn } from '../../policy/domain/repeat-pass';

const HIDDEN_CALLER: ICaller = { number: null, traits: null, networkName: null, contact: null };

/**
 * Whether a group counts on «a repeat rings» while hidden numbers land in it: a hidden number
 * cannot be told calling again, so those calls stay turned away.
 */
export function hiddenCallsMissRepeat(
  book: GroupBook,
  group: TGroup,
  environment: IMatchingEnvironment,
  filterRepeat: TRepeatPass,
  now: Temporal.Instant
): boolean {
  if (!isRepeatPassOn(group.policy.repeatPass, now) && !isRepeatPassOn(filterRepeat, now)) {
    return false;
  }
  const found = membership(book, HIDDEN_CALLER, environment);
  return found.kind === 'one'
    ? found.group.id === group.id
    : found.groups.some(claimant => claimant.id === group.id);
}
