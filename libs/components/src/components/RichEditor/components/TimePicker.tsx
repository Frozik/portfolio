import type { ETimeResolution } from '@frozik/utils';
import { ETimeResolution as Resolution } from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import type { MouseEvent } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useFunction } from '../../../hooks';
import styles from '../styles.module.scss';
import { getCalendarAriaLabels } from '../translations';

const HOURS_MAX = 23;
const MINUTES_MAX = 59;
const SECONDS_MAX = 59;
const MILLISECONDS_MAX = 999;

const HOLD_REPEAT_INTERVAL_MS = 1000;
const HOLD_REPEAT_STEP = 5;

export const TimePicker = memo(
  ({
    time,
    resolution = Resolution.Minutes,
    onTimeChange,
    language,
  }: {
    time: Temporal.PlainTime;
    resolution?: ETimeResolution;
    onTimeChange: (time: Temporal.PlainTime) => void;
    language: string;
  }) => {
    const ariaLabels = useMemo(() => getCalendarAriaLabels(language), [language]);
    const showSeconds = resolution === Resolution.Seconds || resolution === Resolution.Milliseconds;
    const showMilliseconds = resolution === Resolution.Milliseconds;

    const handleMouseDown = useFunction((event: MouseEvent) => {
      event.preventDefault();
    });

    function wrapValue(value: number, max: number): number {
      return ((value % (max + 1)) + (max + 1)) % (max + 1);
    }

    const handleHourChange = useFunction((diff: number) => {
      onTimeChange(
        new Temporal.PlainTime(
          wrapValue(time.hour + diff, HOURS_MAX),
          time.minute,
          time.second,
          time.millisecond
        )
      );
    });

    const handleMinuteChange = useFunction((diff: number) => {
      onTimeChange(
        new Temporal.PlainTime(
          time.hour,
          wrapValue(time.minute + diff, MINUTES_MAX),
          time.second,
          time.millisecond
        )
      );
    });

    const handleSecondChange = useFunction((diff: number) => {
      onTimeChange(
        new Temporal.PlainTime(
          time.hour,
          time.minute,
          wrapValue(time.second + diff, SECONDS_MAX),
          time.millisecond
        )
      );
    });

    const handleMsChange = useFunction((diff: number) => {
      onTimeChange(
        new Temporal.PlainTime(
          time.hour,
          time.minute,
          time.second,
          wrapValue(time.millisecond + diff, MILLISECONDS_MAX)
        )
      );
    });

    const hourStr = useMemo(() => String(time.hour).padStart(2, '0'), [time.hour]);
    const minuteStr = useMemo(() => String(time.minute).padStart(2, '0'), [time.minute]);
    const secondStr = useMemo(() => String(time.second).padStart(2, '0'), [time.second]);
    const msStr = useMemo(() => String(time.millisecond).padStart(3, '0'), [time.millisecond]);

    return (
      <fieldset
        className={styles.timePicker}
        onMouseDown={handleMouseDown}
        aria-label={ariaLabels.time}
      >
        <TimeUnit
          value={hourStr}
          onChange={handleHourChange}
          label={ariaLabels.hours}
          increaseLabel={ariaLabels.increaseHours}
          decreaseLabel={ariaLabels.decreaseHours}
        />
        <span className={styles.timePickerSeparator} aria-hidden="true">
          :
        </span>
        <TimeUnit
          value={minuteStr}
          onChange={handleMinuteChange}
          label={ariaLabels.minutes}
          increaseLabel={ariaLabels.increaseMinutes}
          decreaseLabel={ariaLabels.decreaseMinutes}
        />
        {showSeconds && (
          <>
            <span className={styles.timePickerSeparator} aria-hidden="true">
              :
            </span>
            <TimeUnit
              value={secondStr}
              onChange={handleSecondChange}
              label={ariaLabels.seconds}
              increaseLabel={ariaLabels.increaseSeconds}
              decreaseLabel={ariaLabels.decreaseSeconds}
            />
          </>
        )}
        {showMilliseconds && (
          <>
            <span className={styles.timePickerSeparator} aria-hidden="true">
              .
            </span>
            <TimeUnit
              value={msStr}
              onChange={handleMsChange}
              wide
              label={ariaLabels.milliseconds}
              increaseLabel={ariaLabels.increaseMilliseconds}
              decreaseLabel={ariaLabels.decreaseMilliseconds}
            />
          </>
        )}
      </fieldset>
    );
  }
);

function useHoldRepeat(
  callback: (diff: number) => void,
  diff: number
): {
  onClick: () => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
} {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    firedRef.current = false;
    intervalRef.current = setInterval(() => {
      firedRef.current = true;
      callbackRef.current(diff * HOLD_REPEAT_STEP);
    }, HOLD_REPEAT_INTERVAL_MS);
  }, [stop, diff]);

  const handleClick = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    callbackRef.current(diff);
  }, [diff]);

  useEffect(() => stop, [stop]);

  return { onClick: handleClick, onMouseDown: start, onMouseUp: stop, onMouseLeave: stop };
}

const TimeUnit = memo(
  ({
    value,
    onChange,
    wide = false,
    label,
    increaseLabel,
    decreaseLabel,
  }: {
    value: string;
    onChange: (diff: number) => void;
    wide?: boolean;
    label: string;
    increaseLabel: string;
    decreaseLabel: string;
  }) => {
    const holdUp = useHoldRepeat(onChange, 1);
    const holdDown = useHoldRepeat(onChange, -1);

    return (
      <fieldset
        className={wide ? styles.timePickerUnitWide : styles.timePickerUnit}
        aria-label={label}
      >
        <button
          type="button"
          className={styles.timePickerBtn}
          aria-label={increaseLabel}
          onClick={holdUp.onClick}
          onMouseDown={holdUp.onMouseDown}
          onMouseUp={holdUp.onMouseUp}
          onMouseLeave={holdUp.onMouseLeave}
        >
          ▲
        </button>
        <span className={styles.timePickerValue} aria-live="polite" aria-atomic="true">
          {value}
        </span>
        <button
          type="button"
          className={styles.timePickerBtn}
          aria-label={decreaseLabel}
          onClick={holdDown.onClick}
          onMouseDown={holdDown.onMouseDown}
          onMouseUp={holdDown.onMouseUp}
          onMouseLeave={holdDown.onMouseLeave}
        >
          ▼
        </button>
      </fieldset>
    );
  }
);
