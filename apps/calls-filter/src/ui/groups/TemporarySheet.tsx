import { observer } from 'mobx-react-lite';
import type { Temporal } from 'temporal-polyfill';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { setTemporaryPolicy } from '../../contexts/grouping/domain/group-book-edits';
import { isTemporaryActive, temporaryActionOf } from '../../contexts/policy/domain/action-now';
import { plainDateTimeOf } from '../../contexts/policy/domain/floating-time';
import type { TTemporaryUntil } from '../../contexts/policy/domain/policy';
import { policyText } from '../../texts/policy-phrase';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { useCalendarName } from '../calendars/use-calendar-name';
import { useClockWords } from '../clock-words';
import { groupName } from '../group-name';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { Sheet } from '../kit/Sheet';
import { Wrap } from '../kit/Wrap';

const DAY_TERMS = [1, 2, 3, 5] as const;
const EVENING_HOUR = 20;
/** «Until the first call» never outlives a day: a forgotten one must not open the group for good. */
const FIRST_PASS_LIMIT_HOURS = 24;

/**
 * A group's change for a while: the opposite of what it does now, set by one tap on the term.
 * Opened from the list of groups it names the group and its usual policy; inside the group, both
 * are already on screen.
 */
export const TemporarySheet = observer(function TemporarySheet({
  group,
  named,
  onClose,
}: {
  readonly group: TGroup | null;
  readonly named: boolean;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const calendarName = useCalendarName();
  const clockWords = useClockWords();
  if (group === null) {
    return null;
  }
  const { clock } = app;
  const now = clock.now();
  const status = app.statusOf(group);
  const chosen = temporaryActionOf(status.now);
  const set = (until: TTemporaryUntil | null) => {
    app.books.run((book, context) =>
      setTemporaryPolicy(
        book,
        group.id,
        until === null ? null : { action: chosen, until, setAt: context.now },
        context.now
      )
    );
    onClose();
  };
  const at = (instant: Temporal.Instant): TTemporaryUntil => ({ kind: 'instant', at: instant });
  const local = clock.localNow();
  const evening = local.with({ hour: EVENING_HOUR, minute: 0, second: 0 });
  const eveningInstant = (evening.hour > local.hour ? evening : evening.add({ days: 1 }))
    .toZonedDateTime(clock.timeZone())
    .toInstant();
  const meetingEnd =
    status.now.source === 'scheduled' || group.policy.scheduled?.calendars.length
      ? status.now.changesAt
      : null;
  return (
    <Sheet visible title={texts.temporary.title(chosen)} onClose={onClose} testID="temporary-sheet">
      {named ? (
        <Hint
          testID="temporary-usually"
          text={texts.temporary.usually(
            groupName(texts, group),
            policyText(texts, group.policy, calendarName, clockWords)
          )}
        />
      ) : null}
      <Wrap>
        <Chip
          testID="temporary-1h"
          label={texts.temporary.hour}
          onPress={() => set(at(now.add({ hours: 1 })))}
        />
        <Chip
          testID="temporary-evening"
          label={texts.temporary.evening}
          onPress={() => set(at(eveningInstant))}
        />
        {DAY_TERMS.map(days => (
          <Chip
            key={days}
            testID={`temporary-${days}d`}
            label={texts.temporary.days(days)}
            onPress={() =>
              set(
                at(local.toPlainDate().add({ days }).toZonedDateTime(clock.timeZone()).toInstant())
              )
            }
          />
        ))}
        {chosen === 'block' ? null : (
          <Chip
            testID="temporary-first-call"
            label={texts.temporary.firstCall}
            onPress={() =>
              set({ kind: 'first-pass', latest: now.add({ hours: FIRST_PASS_LIMIT_HOURS }) })
            }
          />
        )}
        {meetingEnd?.kind === 'local' ? (
          <Chip
            testID="temporary-end-of-event"
            label={texts.temporary.endOfEvent}
            onPress={() =>
              set({
                kind: 'end-of-event',
                at: plainDateTimeOf(meetingEnd.at).toZonedDateTime(clock.timeZone()).toInstant(),
              })
            }
          />
        ) : null}
      </Wrap>
      {isTemporaryActive(group.temporary, now) ? (
        <Button
          testID="temporary-reset"
          variant="secondary"
          label={texts.temporary.backToUsual}
          onPress={() => set(null)}
        />
      ) : null}
    </Sheet>
  );
});
