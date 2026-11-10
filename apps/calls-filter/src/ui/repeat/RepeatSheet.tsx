import { observer } from 'mobx-react-lite';
import type { Temporal } from 'temporal-polyfill';

import type { TRepeatPass } from '../../contexts/policy/domain/repeat-pass';
import { REPEAT_OFF } from '../../contexts/policy/domain/repeat-pass';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { pickDate } from '../kit/pick-date';
import { Sheet } from '../kit/Sheet';
import { Wrap } from '../kit/Wrap';

const HOUR_TERMS = [1, 4, 8] as const;
const DAY_TERMS = [1, 7] as const;
const REPEAT_WINDOWS = [2, 5, 10, 15] as const;

/** «A repeat call rings»: off, for good, or for a term — one tap sets it. */
export const RepeatSheet = observer(function RepeatSheet({
  value,
  hint,
  onChange,
  onClose,
  window,
}: {
  readonly value: TRepeatPass;
  readonly hint: string;
  readonly onChange: (repeat: TRepeatPass) => void;
  readonly onClose: () => void;
  /** A group's own: how many minutes after a turned-away call a second one counts as a repeat. */
  readonly window?: { readonly minutes: number; readonly onChange: (minutes: number) => void };
}) {
  const app = useApp();
  const texts = useTexts();
  const { clock } = app;
  const choose = (repeat: TRepeatPass) => {
    onChange(repeat);
    onClose();
  };
  const until = (instant: Temporal.Instant) => choose({ kind: 'until', until: instant });
  const today = clock.localNow().toPlainDate();
  const chooseDate = async () => {
    const date = await pickDate(today.add({ days: 1 }), today);
    if (date !== null) {
      until(date.add({ days: 1 }).toZonedDateTime(clock.timeZone()).toInstant());
    }
  };
  return (
    <Sheet visible title={texts.repeat.title} onClose={onClose} testID="repeat-sheet">
      <Hint text={hint} />
      <Wrap>
        <Chip
          testID="repeat-off"
          label={texts.repeat.off}
          selected={value.kind === 'off'}
          onPress={() => choose(REPEAT_OFF)}
        />
        <Chip
          testID="repeat-always"
          label={texts.repeat.always}
          selected={value.kind === 'always'}
          onPress={() => choose({ kind: 'always' })}
        />
      </Wrap>
      <Wrap>
        {HOUR_TERMS.map(hours => (
          <Chip
            key={`h${hours}`}
            testID={`repeat-${hours}h`}
            label={texts.repeat.hours(hours)}
            onPress={() => until(clock.now().add({ hours }))}
          />
        ))}
        {DAY_TERMS.map(days => (
          <Chip
            key={`d${days}`}
            testID={`repeat-${days}d`}
            label={texts.repeat.days(days)}
            onPress={() =>
              until(clock.localNow().add({ days }).toZonedDateTime(clock.timeZone()).toInstant())
            }
          />
        ))}
        <Chip
          testID="repeat-date"
          label={texts.repeat.untilDate}
          onPress={() => void chooseDate()}
        />
      </Wrap>
      {window === undefined ? null : (
        <>
          <Hint text={texts.group.repeatWindow(window.minutes)} />
          <Wrap>
            {REPEAT_WINDOWS.map(minutes => (
              <Chip
                key={minutes}
                testID={`repeat-window-${minutes}`}
                label={String(minutes)}
                selected={window.minutes === minutes}
                onPress={() => window.onChange(minutes)}
              />
            ))}
          </Wrap>
        </>
      )}
    </Sheet>
  );
});
