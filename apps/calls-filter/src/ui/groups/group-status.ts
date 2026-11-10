import type { Temporal } from 'temporal-polyfill';

import type { IActivityNow } from '../../contexts/policy/domain/activity-now';
import type { IPolicy } from '../../contexts/policy/domain/policy';
import type { ITexts } from '../../texts/texts';
import { ruleLine } from './rule-line';

/** A group's status in words, where its colours do not show: a label, a hint. */
export function statusText(
  texts: ITexts,
  policy: IPolicy,
  now: IActivityNow,
  today: Temporal.PlainDate
): string {
  const action = texts.actions[policy.action];
  const line = now.activity === 'off' ? texts.groups.off : ruleLine(texts, now, today);
  return line === null ? action : `${action} · ${line}`;
}
