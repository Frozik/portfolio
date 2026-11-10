import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import type { IActivityNow } from '../../contexts/policy/domain/activity-now';
import type { ITexts } from '../../texts/texts';
import { changeText } from '../format';

/**
 * Under a group's name: until when its conditions hold, or from when they will — the action
 * itself shows in the row's colour, a switched-off group in its dot. Nothing when nothing changes.
 */
export function ruleLine(
  texts: ITexts,
  now: IActivityNow,
  today: Temporal.PlainDate
): string | null {
  const when = changeText(texts, now.changesAt, today);
  if (when === null) {
    return null;
  }
  switch (now.activity) {
    case 'conditions-hold':
      return texts.groups.activeUntil(when);
    case 'conditions-unmet':
      return texts.groups.activeFrom(when);
    case 'always':
    case 'off':
      return null;
    default:
      return assertNever(now.activity);
  }
}
