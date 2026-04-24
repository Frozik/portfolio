import type { DateTimeParseResult, EDayOfWeek, EDayType, ETimeResolution } from '@frozik/utils';
import { EDateTimeStep, stepDateTime } from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import * as Popover from '@radix-ui/react-popover';
import { isNil } from 'lodash-es';
import type { KeyboardEvent } from 'react';
import { memo, useId, useMemo, useRef, useState } from 'react';

import { useFunction } from '../../hooks';
import { cn } from '../cn';
import { CalendarPopup } from './components/CalendarPopup';
import { RichEditor } from './components/RichEditor';
import type { ISelection } from './defs';
import styles from './styles.module.scss';
import { getCalendarAriaLabels } from './translations/index';

const DEFAULT_TIME_ZONE = 'UTC';
const MIDNIGHT = new Temporal.PlainTime(0);
/**
 * Floats above page-level stacking contexts (host apps often wrap their
 * content in `relative z-10` layers to sit above a canvas background —
 * Radix Portal's `z-index: auto` would otherwise place the popover below
 * them).
 */
const POPOVER_Z_INDEX = 100;

function defaultFormatDate(value: Temporal.ZonedDateTime): string {
  const date = value.toPlainDate().toString();
  const hasTime =
    value.hour !== 0 || value.minute !== 0 || value.second !== 0 || value.millisecond !== 0;

  if (!hasTime) {
    return date;
  }

  if (value.millisecond !== 0) {
    return `${date} ${pad2(value.hour)}:${pad2(value.minute)}:${pad2(value.second)}.${pad3(value.millisecond)}`;
  }

  if (value.second !== 0) {
    return `${date} ${pad2(value.hour)}:${pad2(value.minute)}:${pad2(value.second)}`;
  }

  return `${date} ${pad2(value.hour)}:${pad2(value.minute)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

export const DateTimePicker = memo(
  ({
    className,
    value,
    onValueChange,
    timeZone = DEFAULT_TIME_ZONE,
    onParseInput,
    getDayInfo,
    startOfWeek,
    step = EDateTimeStep.Day,
    timeResolution,
    minDate,
    maxDate,
    formatDate = defaultFormatDate,
    placeholder,
    today,
    disabled = false,
    language = 'en',
  }: {
    className?: string;
    value?: Temporal.ZonedDateTime;
    onValueChange?: (value: Temporal.ZonedDateTime | undefined) => void;
    timeZone?: string;
    onParseInput: (text: string) => DateTimeParseResult;
    getDayInfo?: (date: Temporal.PlainDate) => EDayType;
    startOfWeek?: EDayOfWeek;
    step?: EDateTimeStep;
    timeResolution?: ETimeResolution;
    minDate?: Temporal.PlainDate;
    maxDate?: Temporal.PlainDate;
    formatDate?: (value: Temporal.ZonedDateTime) => string;
    placeholder?: string;
    today?: Temporal.PlainDate;
    disabled?: boolean;
    language?: string;
  }) => {
    const calendarAriaLabels = useMemo(() => getCalendarAriaLabels(language), [language]);
    const [focused, setFocused] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const [inputText, setInputText] = useState('');
    const lastCommittedValueRef = useRef<Temporal.ZonedDateTime | undefined>(value);

    const displayText = useMemo(() => {
      if (focused) {
        return inputText;
      }

      // Keep invalid text visible so user can fix a typo
      if (!isNil(error)) {
        return inputText;
      }

      if (!isNil(value)) {
        return formatDate(value);
      }

      return '';
    }, [focused, inputText, value, formatDate, error]);

    const selectedPlainDate = useMemo(() => value?.toPlainDate(), [value]);
    const selectedPlainTime = useMemo(() => value?.toPlainTime() ?? MIDNIGHT, [value]);

    const clampToRange = useFunction((zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime => {
      const plain = zdt.toPlainDate();

      if (!isNil(minDate) && Temporal.PlainDate.compare(plain, minDate) < 0) {
        return minDate.toZonedDateTime({ timeZone, plainTime: zdt.toPlainTime() });
      }

      if (!isNil(maxDate) && Temporal.PlainDate.compare(plain, maxDate) > 0) {
        return maxDate.toZonedDateTime({ timeZone, plainTime: zdt.toPlainTime() });
      }

      return zdt;
    });

    const commitValue = useFunction((newValue: Temporal.ZonedDateTime) => {
      const clamped = clampToRange(newValue);
      lastCommittedValueRef.current = clamped;
      setError(undefined);
      onValueChange?.(clamped);
    });

    const handleFocusChanges = useFunction((newFocused: boolean) => {
      if (newFocused && !focused) {
        // Keep invalid text so user can fix a typo; only reset if no error
        if (isNil(error)) {
          setInputText(isNil(value) ? '' : formatDate(value));
        }
      }

      if (!newFocused && focused) {
        const trimmed = inputText.trim();

        if (trimmed.length === 0) {
          setError(undefined);
          lastCommittedValueRef.current = undefined;
          onValueChange?.(undefined);
        } else {
          const result = onParseInput(trimmed);

          if (result.success) {
            commitValue(result.value);
          } else {
            setError(result.reason);
          }
        }
      }

      setFocused(newFocused);
    });

    const handleFocusSelection = useFunction((currentValue: string): ISelection | undefined => {
      if (currentValue.length === 0) {
        return undefined;
      }
      return { start: 0, end: currentValue.length };
    });

    const handleKeyDown = useFunction((event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        setError(undefined);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const direction = event.key === 'ArrowUp' ? 1 : -1;

        const baseValue = lastCommittedValueRef.current ?? Temporal.Now.zonedDateTimeISO(timeZone);
        const stepped = stepDateTime(baseValue, step, direction);
        const clamped = clampToRange(stepped);

        commitValue(clamped);
        setInputText(formatDate(clamped));
      }

      if (event.key === 'Enter') {
        const trimmed = inputText.trim();

        if (trimmed.length === 0) {
          setError(undefined);
          lastCommittedValueRef.current = undefined;
          onValueChange?.(undefined);
        } else {
          const result = onParseInput(trimmed);

          if (result.success) {
            commitValue(result.value);
            setInputText(formatDate(clampToRange(result.value)));
          } else {
            setError(result.reason);
          }
        }
      }
    });

    const handleSelectCalendarDate = useFunction((date: Temporal.PlainDate) => {
      // Preserve the current time when selecting a date from the calendar
      const currentTime = lastCommittedValueRef.current?.toPlainTime() ?? MIDNIGHT;
      const zdt = date.toZonedDateTime({ timeZone, plainTime: currentTime });
      commitValue(zdt);
      setInputText(formatDate(clampToRange(zdt)));
    });

    const handleTimeChange = useFunction((newTime: Temporal.PlainTime) => {
      const currentDate =
        lastCommittedValueRef.current?.toPlainDate() ??
        today ??
        Temporal.Now.plainDateISO(timeZone);
      const zdt = currentDate.toZonedDateTime({ timeZone, plainTime: newTime });
      commitValue(zdt);
      setInputText(formatDate(clampToRange(zdt)));
    });

    const hasError = !isNil(error);
    const errorId = useId();

    return (
      <Popover.Root open={focused}>
        <Popover.Anchor>
          <RichEditor
            className={cn(styles.editor, hasError && styles.editorError, className)}
            disabled={disabled}
            value={displayText}
            placeholder={
              !isNil(placeholder)
                ? `<span class="${styles.placeholder}">${placeholder}</span>`
                : undefined
            }
            onValueChanged={setInputText}
            onFocusChanges={handleFocusChanges}
            onFocusSelection={handleFocusSelection}
            onKeyDown={handleKeyDown}
            aria-label={calendarAriaLabels.dateInputLabel}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
          />
          {hasError && (
            <div id={errorId} className={styles.errorTooltip} role="alert">
              {error}
            </div>
          )}
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            sideOffset={4}
            onOpenAutoFocus={preventFocusSteal}
            onCloseAutoFocus={preventFocusSteal}
            style={{ zIndex: POPOVER_Z_INDEX }}
          >
            <CalendarPopup
              value={selectedPlainDate}
              time={selectedPlainTime}
              today={today}
              getDayInfo={getDayInfo}
              startOfWeek={startOfWeek}
              timeResolution={timeResolution}
              minDate={minDate}
              maxDate={maxDate}
              onSelectDate={handleSelectCalendarDate}
              onTimeChange={handleTimeChange}
              language={language}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);

function preventFocusSteal(event: Event): void {
  event.preventDefault();
}
