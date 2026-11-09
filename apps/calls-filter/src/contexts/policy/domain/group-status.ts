import { assertNever } from '@frozik/utils/assert/assertNever';

import type { IActionNow, IMoment } from './action-now';
import { actionNow } from './action-now';
import type { TFloatingMinute } from './floating-time';
import type { TPlaceFacts } from './place-rule';
import type { IPolicy, ITemporaryPolicy } from './policy';
import type { TWindowSet } from './window-set';

const MILLISECONDS_PER_MINUTE = 60_000;

export interface IGroupStatus {
  readonly now: IActionNow;
  readonly next: IActionNow | null;
}

/** The moment right after a change, on both clocks: what the group does from then on. */
function momentAfter(moment: IMoment, changesAt: NonNullable<IActionNow['changesAt']>): IMoment {
  switch (changesAt.kind) {
    case 'instant':
      return {
        instant: changesAt.at.add({ seconds: 1 }),
        local: (moment.local +
          Math.ceil(
            (changesAt.at.epochMilliseconds - moment.instant.epochMilliseconds) /
              MILLISECONDS_PER_MINUTE
          )) as TFloatingMinute,
      };
    case 'local':
      return {
        instant: moment.instant.add({ minutes: changesAt.at - moment.local }),
        local: changesAt.at,
      };
    default:
      return assertNever(changesAt);
  }
}

/** What a group does with a call now, and what it does once that changes. */
export function groupStatus(
  group: { readonly policy: IPolicy; readonly temporary: ITemporaryPolicy | null },
  moment: IMoment,
  windows: TWindowSet | null,
  atPlace: TPlaceFacts
): IGroupStatus {
  const now = actionNow(group, moment, windows, atPlace);
  if (now.changesAt === null) {
    return { now, next: null };
  }
  return { now, next: actionNow(group, momentAfter(moment, now.changesAt), windows, atPlace) };
}
