import { observer } from 'mobx-react-lite';
import type { Temporal } from 'temporal-polyfill';

import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Chip } from '../kit/Chip';
import { Sheet } from '../kit/Sheet';
import { Wrap } from '../kit/Wrap';

const PAUSE_HOURS = [1, 2, 4, 8] as const;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

/** The whole filter off for a while: one tap on a term starts it. */
export const PauseSheet = observer(function PauseSheet({
  visible,
  onClose,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const { clock } = app;
  const pauseUntil = (until: Temporal.Instant) => {
    app.device.pause(until);
    onClose();
  };
  const today = clock.localNow();
  const tomorrow = today
    .toPlainDate()
    .add({ days: 1 })
    .toZonedDateTime(clock.timeZone())
    .toInstant();
  return (
    <Sheet visible={visible} title={texts.pause.title} onClose={onClose} testID="pause-sheet">
      <Wrap>
        {PAUSE_HOURS.map(hours => (
          <Chip
            key={hours}
            testID={`pause-${hours}h`}
            label={texts.pause.hours(hours)}
            onPress={() => pauseUntil(clock.now().add({ hours }))}
          />
        ))}
        <Chip
          testID="pause-day"
          label={texts.pause.days(1)}
          onPress={() => pauseUntil(clock.now().add({ hours: HOURS_PER_DAY }))}
        />
        <Chip
          testID="pause-week"
          label={texts.pause.weeks(1)}
          onPress={() => pauseUntil(clock.now().add({ hours: HOURS_PER_DAY * DAYS_PER_WEEK }))}
        />
        <Chip
          testID="pause-tomorrow"
          label={texts.pause.untilTomorrow}
          onPress={() => pauseUntil(tomorrow)}
        />
      </Wrap>
    </Sheet>
  );
});
