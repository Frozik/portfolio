import type { Temporal } from 'temporal-polyfill';
import type { IGroupStatus } from '../../contexts/policy/domain/group-status';
import type { ITexts } from '../../texts/texts';
import { changeText } from '../format';

/** «✅ until 18:00, then ⛔» — what a group does now, in the list's words. */
export function statusText(
  texts: ITexts,
  status: IGroupStatus,
  zone: string,
  today: Temporal.PlainDate
): string {
  const now = texts.actionsShort[status.now.action];
  const until = changeText(texts, status.now.changesAt, zone, today);
  if (until === null || status.next === null) {
    return texts.groups.nowAlways(now);
  }
  return texts.groups.nowUntil(now, until, texts.actionsShort[status.next.action]);
}
