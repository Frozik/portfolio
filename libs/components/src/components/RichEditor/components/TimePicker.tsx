import type { ETimeResolution } from '@frozik/utils';
import { ETimeResolution as Resolution } from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import type { MouseEvent } from 'react';
import { memo, useMemo } from 'react';

import { useFunction } from '../../../hooks';
import styles from '../styles.module.scss';

const HOURS_MAX = 23;
const MINUTES_MAX = 59;
const SECONDS_MAX = 59;
const MILLISECONDS_MAX = 999;

export const TimePicker = memo(
  ({
    time,
    resolution = Resolution.Minutes,
    onTimeChange,
  }: {
    time: Temporal.PlainTime;
    resolution?: ETimeResolution;
    onTimeChange: (time: Temporal.PlainTime) => void;
  }) => {
    const showSeconds = resolution === Resolution.Seconds || resolution === Resolution.Milliseconds;
    const showMilliseconds = resolution === Resolution.Milliseconds;

    const handleMouseDown = useFunction((event: MouseEvent) => {
      event.preventDefault();
    });

    const handleHourUp = useFunction(() => {
      onTimeChange(
        new Temporal.PlainTime(
          (time.hour + 1) % (HOURS_MAX + 1),
          time.minute,
          time.second,
          time.millisecond
        )
      );
    });

    const handleHourDown = useFunction(() => {
      onTimeChange(
        new Temporal.PlainTime(
          (time.hour + HOURS_MAX) % (HOURS_MAX + 1),
          time.minute,
          time.second,
          time.millisecond
        )
      );
    });

    const handleMinuteUp = useFunction(() => {
      onTimeChange(
        new Temporal.PlainTime(
          time.hour,
          (time.minute + 1) % (MINUTES_MAX + 1),
          time.second,
          time.millisecond
        )
      );
    });

    const handleMinuteDown = useFunction(() => {
      onTimeChange(
        new Temporal.PlainTime(
          time.hour,
          (time.minute + MINUTES_MAX) % (MINUTES_MAX + 1),
          time.second,
          time.millisecond
        )
      );
    });

    const handleSecondUp = useFunction(() => {
      onTimeChange(
        new Temporal.PlainTime(
          time.hour,
          time.minute,
          (time.second + 1) % (SECONDS_MAX + 1),
          time.millisecond
        )
      );
    });

    const handleSecondDown = useFunction(() => {
      onTimeChange(
        new Temporal.PlainTime(
          time.hour,
          time.minute,
          (time.second + SECONDS_MAX) % (SECONDS_MAX + 1),
          time.millisecond
        )
      );
    });

    const handleMsUp = useFunction(() => {
      onTimeChange(
        new Temporal.PlainTime(
          time.hour,
          time.minute,
          time.second,
          (time.millisecond + 1) % (MILLISECONDS_MAX + 1)
        )
      );
    });

    const handleMsDown = useFunction(() => {
      onTimeChange(
        new Temporal.PlainTime(
          time.hour,
          time.minute,
          time.second,
          (time.millisecond + MILLISECONDS_MAX) % (MILLISECONDS_MAX + 1)
        )
      );
    });

    const hourStr = useMemo(() => String(time.hour).padStart(2, '0'), [time.hour]);
    const minuteStr = useMemo(() => String(time.minute).padStart(2, '0'), [time.minute]);
    const secondStr = useMemo(() => String(time.second).padStart(2, '0'), [time.second]);
    const msStr = useMemo(() => String(time.millisecond).padStart(3, '0'), [time.millisecond]);

    return (
      <div className={styles.timePicker} onMouseDown={handleMouseDown}>
        <TimeUnit value={hourStr} onUp={handleHourUp} onDown={handleHourDown} />
        <span className={styles.timePickerSeparator}>:</span>
        <TimeUnit value={minuteStr} onUp={handleMinuteUp} onDown={handleMinuteDown} />
        {showSeconds && (
          <>
            <span className={styles.timePickerSeparator}>:</span>
            <TimeUnit value={secondStr} onUp={handleSecondUp} onDown={handleSecondDown} />
          </>
        )}
        {showMilliseconds && (
          <>
            <span className={styles.timePickerSeparator}>.</span>
            <TimeUnit value={msStr} onUp={handleMsUp} onDown={handleMsDown} wide />
          </>
        )}
      </div>
    );
  }
);

const TimeUnit = memo(
  ({
    value,
    onUp,
    onDown,
    wide = false,
  }: {
    value: string;
    onUp: () => void;
    onDown: () => void;
    wide?: boolean;
  }) => {
    return (
      <div className={wide ? styles.timePickerUnitWide : styles.timePickerUnit}>
        <button type="button" className={styles.timePickerBtn} onClick={onUp}>
          ▲
        </button>
        <span className={styles.timePickerValue}>{value}</span>
        <button type="button" className={styles.timePickerBtn} onClick={onDown}>
          ▼
        </button>
      </div>
    );
  }
);
