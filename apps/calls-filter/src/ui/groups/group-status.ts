import type { Temporal } from 'temporal-polyfill';

import type { TAction } from '../../contexts/policy/domain/action';
import type { IGroupStatus } from '../../contexts/policy/domain/group-status';
import type { ITexts } from '../../texts/texts';
import { changeText } from '../format';

/** A piece of a group's status line, coloured by its action; `null` for the plain words between. */
export interface IStatusPart {
  readonly action: TAction | null;
  readonly text: string;
}

/**
 * «Pass until 18:00, then block» — what a group does now, until when, and only what comes
 * next: the line shows the state and its next change, never the whole timetable.
 */
export function statusParts(
  texts: ITexts,
  status: IGroupStatus,
  zone: string,
  today: Temporal.PlainDate
): readonly IStatusPart[] {
  const until = changeText(texts, status.now.changesAt, zone, today);
  const { action } = status.now;
  if (until === null || status.next === null) {
    return [{ action, text: texts.groups.now(action, null) }];
  }
  return [
    { action, text: texts.groups.now(action, until) },
    { action: null, text: texts.groups.thenSeparator },
    { action: status.next.action, text: texts.groups.next(status.next.action) },
  ];
}

/** The same status as plain words, where it cannot be coloured: a label, a hint. */
export function statusText(
  texts: ITexts,
  status: IGroupStatus,
  zone: string,
  today: Temporal.PlainDate
): string {
  return statusParts(texts, status, zone, today)
    .map(part => part.text)
    .join('');
}
