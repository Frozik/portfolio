import { assertNever } from '@frozik/utils/assert/assertNever';
import type { ETimeResolution } from '@frozik/utils/date/constants';
import { ETimeResolution as Resolution } from '@frozik/utils/date/constants';
import type { KeyboardEvent, MouseEvent, Ref } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import type { Temporal } from 'temporal-polyfill';

import { useFunction } from '../../../hooks/useFunction';
import type { ICalendarAriaLabels, TLeaveDirection } from '../defs';
import styles from '../styles.module.scss';

type TTimeUnit = 'hour' | 'minute' | 'second' | 'millisecond';

const UNIT_MAX: Readonly<Record<TTimeUnit, number>> = {
  hour: 23,
  minute: 59,
  second: 59,
  millisecond: 999,
};
const UNIT_WIDTH: Readonly<Record<TTimeUnit, number>> = {
  hour: 2,
  minute: 2,
  second: 2,
  millisecond: 3,
};

const HOLD_INITIAL_DELAY_MS = 400;
const HOLD_REPEAT_INTERVAL_MS = 80;
const SHIFT_STEP = 10;

function wrap(value: number, max: number): number {
  const size = max + 1;
  return ((value % size) + size) % size;
}

/** Steps one unit without carrying into the next: each spinner is independent. */
function stepUnit(time: Temporal.PlainTime, unit: TTimeUnit, diff: number): Temporal.PlainTime {
  const wrapped = wrap(time[unit] + diff, UNIT_MAX[unit]);

  switch (unit) {
    case 'hour':
      return time.with({ hour: wrapped });
    case 'minute':
      return time.with({ minute: wrapped });
    case 'second':
      return time.with({ second: wrapped });
    case 'millisecond':
      return time.with({ millisecond: wrapped });
    default:
      return assertNever(unit);
  }
}

function unitsOf(resolution: ETimeResolution): readonly TTimeUnit[] {
  switch (resolution) {
    case Resolution.Milliseconds:
      return ['hour', 'minute', 'second', 'millisecond'];
    case Resolution.Seconds:
      return ['hour', 'minute', 'second'];
    case Resolution.Minutes:
      return ['hour', 'minute'];
    default:
      return assertNever(resolution);
  }
}

function labelsOf(
  unit: TTimeUnit,
  ariaLabels: ICalendarAriaLabels
): { readonly label: string; readonly increase: string; readonly decrease: string } {
  switch (unit) {
    case 'hour':
      return {
        label: ariaLabels.hours,
        increase: ariaLabels.increaseHours,
        decrease: ariaLabels.decreaseHours,
      };
    case 'minute':
      return {
        label: ariaLabels.minutes,
        increase: ariaLabels.increaseMinutes,
        decrease: ariaLabels.decreaseMinutes,
      };
    case 'second':
      return {
        label: ariaLabels.seconds,
        increase: ariaLabels.increaseSeconds,
        decrease: ariaLabels.decreaseSeconds,
      };
    case 'millisecond':
      return {
        label: ariaLabels.milliseconds,
        increase: ariaLabels.increaseMilliseconds,
        decrease: ariaLabels.decreaseMilliseconds,
      };
    default:
      return assertNever(unit);
  }
}

export const TimePicker = memo(
  ({
    time,
    resolution = Resolution.Minutes,
    focusRequest,
    onTimeChange,
    onLeave,
    onReturnToField,
    ariaLabels,
  }: {
    readonly time: Temporal.PlainTime;
    readonly resolution?: ETimeResolution;
    /** Bumped by the owner to move the keyboard onto the active unit. */
    readonly focusRequest: number;
    readonly onTimeChange: (time: Temporal.PlainTime) => void;
    readonly onLeave: (direction: TLeaveDirection) => void;
    readonly onReturnToField: () => void;
    readonly ariaLabels: ICalendarAriaLabels;
  }) => {
    const units = unitsOf(resolution);
    const [activeUnit, setActiveUnit] = useState<TTimeUnit>('hour');
    const activeUnitRef = useRef<HTMLSpanElement>(null);
    const followActiveUnitRef = useRef(false);

    useEffect(() => {
      if (focusRequest > 0) {
        activeUnitRef.current?.focus();
      }
    }, [focusRequest]);

    // An arrow moved the active unit; the keyboard follows it once it is rendered.
    useEffect(() => {
      if (followActiveUnitRef.current) {
        followActiveUnitRef.current = false;
        activeUnitRef.current?.focus();
      }
    });

    // The field keeps focus (and the popover stays open) while the spinners are clicked.
    const handleMouseDown = useFunction((event: MouseEvent) => {
      event.preventDefault();
    });

    const handleStep = useFunction((unit: TTimeUnit, diff: number) => {
      onTimeChange(stepUnit(time, unit, diff));
    });

    const handleKeyDown = useFunction((event: KeyboardEvent<HTMLSpanElement>, unit: TTimeUnit) => {
      const index = units.indexOf(unit);

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          handleStep(unit, event.shiftKey ? SHIFT_STEP : 1);
          return;
        case 'ArrowDown':
          event.preventDefault();
          handleStep(unit, event.shiftKey ? -SHIFT_STEP : -1);
          return;
        case 'ArrowLeft':
          event.preventDefault();
          followActiveUnitRef.current = true;
          setActiveUnit(units[Math.max(0, index - 1)]);
          return;
        case 'ArrowRight':
          event.preventDefault();
          followActiveUnitRef.current = true;
          setActiveUnit(units[Math.min(units.length - 1, index + 1)]);
          return;
        case 'Tab':
          event.preventDefault();
          onLeave(event.shiftKey ? 'backward' : 'forward');
          return;
        case 'Enter':
        case 'Escape':
          event.preventDefault();
          onReturnToField();
          return;
        default:
          return;
      }
    });

    return (
      <fieldset
        className={styles.timePicker}
        onMouseDown={handleMouseDown}
        aria-label={ariaLabels.time}
      >
        {units.map((unit, index) => (
          <TimeUnit
            key={unit}
            ref={unit === activeUnit ? activeUnitRef : undefined}
            unit={unit}
            time={time}
            active={unit === activeUnit}
            separator={index === 0 ? undefined : unit === 'millisecond' ? '.' : ':'}
            onStep={handleStep}
            onKeyDown={handleKeyDown}
            {...labelsOf(unit, ariaLabels)}
          />
        ))}
      </fieldset>
    );
  }
);

/** Click steps once; holding the pointer repeats after a short delay. */
function useHoldRepeat(onStep: () => void): {
  readonly onClick: () => void;
  readonly onPointerDown: () => void;
  readonly onPointerUp: () => void;
  readonly onPointerLeave: () => void;
  readonly onPointerCancel: () => void;
} {
  const delayRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const repeatedRef = useRef(false);
  const step = useFunction(onStep);

  const stop = useFunction(() => {
    clearTimeout(delayRef.current);
    clearInterval(intervalRef.current);
    delayRef.current = undefined;
    intervalRef.current = undefined;
  });

  const start = useFunction(() => {
    stop();
    repeatedRef.current = false;
    delayRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        repeatedRef.current = true;
        step();
      }, HOLD_REPEAT_INTERVAL_MS);
    }, HOLD_INITIAL_DELAY_MS);
  });

  // A click that ends a hold has already stepped through the repeat.
  const handleClick = useFunction(() => {
    if (repeatedRef.current) {
      repeatedRef.current = false;
      return;
    }
    step();
  });

  useEffect(() => stop, [stop]);

  return {
    onClick: handleClick,
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  };
}

const TimeUnit = memo(
  ({
    ref,
    unit,
    time,
    active,
    separator,
    onStep,
    onKeyDown,
    label,
    increase,
    decrease,
  }: {
    readonly ref?: Ref<HTMLSpanElement>;
    readonly unit: TTimeUnit;
    readonly time: Temporal.PlainTime;
    readonly active: boolean;
    readonly separator: string | undefined;
    readonly onStep: (unit: TTimeUnit, diff: number) => void;
    readonly onKeyDown: (event: KeyboardEvent<HTMLSpanElement>, unit: TTimeUnit) => void;
    readonly label: string;
    readonly increase: string;
    readonly decrease: string;
  }) => {
    const holdUp = useHoldRepeat(() => onStep(unit, 1));
    const holdDown = useHoldRepeat(() => onStep(unit, -1));
    const handleKeyDown = useFunction((event: KeyboardEvent<HTMLSpanElement>) =>
      onKeyDown(event, unit)
    );
    const value = time[unit];

    return (
      <>
        {separator !== undefined && (
          <span className={styles.timePickerSeparator} aria-hidden="true">
            {separator}
          </span>
        )}
        <div className={unit === 'millisecond' ? styles.timePickerUnitWide : styles.timePickerUnit}>
          <button
            type="button"
            tabIndex={-1}
            className={styles.timePickerBtn}
            aria-label={increase}
            {...holdUp}
          >
            ▲
          </button>
          <span
            ref={ref}
            role="spinbutton"
            tabIndex={active ? 0 : -1}
            className={styles.timePickerValue}
            aria-label={label}
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={UNIT_MAX[unit]}
            onKeyDown={handleKeyDown}
          >
            {String(value).padStart(UNIT_WIDTH[unit], '0')}
          </span>
          <button
            type="button"
            tabIndex={-1}
            className={styles.timePickerBtn}
            aria-label={decrease}
            {...holdDown}
          >
            ▼
          </button>
        </div>
      </>
    );
  }
);
