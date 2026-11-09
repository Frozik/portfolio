import { observer } from 'mobx-react-lite';
import type { Temporal } from 'temporal-polyfill';

import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Chip } from '../kit/Chip';
import { Sheet } from '../kit/Sheet';
import { Wrap } from '../kit/Wrap';

const EVENING_HOUR = 20;

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
  const evening = today.with({ hour: EVENING_HOUR, minute: 0, second: 0 });
  const eveningInstant = (evening.hour > today.hour ? evening : evening.add({ days: 1 }))
    .toZonedDateTime(clock.timeZone())
    .toInstant();
  const tomorrow = today
    .toPlainDate()
    .add({ days: 1 })
    .toZonedDateTime(clock.timeZone())
    .toInstant();
  return (
    <Sheet visible={visible} title={texts.pause.title} onClose={onClose} testID="pause-sheet">
      <Wrap>
        <Chip
          testID="pause-30m"
          label={texts.pause.minutes(30)}
          onPress={() => pauseUntil(clock.now().add({ minutes: 30 }))}
        />
        <Chip
          testID="pause-1h"
          label={texts.pause.hours(1)}
          onPress={() => pauseUntil(clock.now().add({ hours: 1 }))}
        />
        <Chip
          testID="pause-2h"
          label={texts.pause.hours(2)}
          onPress={() => pauseUntil(clock.now().add({ hours: 2 }))}
        />
        <Chip
          testID="pause-evening"
          label={texts.pause.untilEvening}
          onPress={() => pauseUntil(eveningInstant)}
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
