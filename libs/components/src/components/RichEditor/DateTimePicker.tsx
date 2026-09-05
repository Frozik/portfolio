import type { EDayOfWeek, EDayType } from '@frozik/utils/date/constants';
import { EDateTimeStep, ETimeResolution } from '@frozik/utils/date/constants';
import type { DateTimeParseResult } from '@frozik/utils/date/fuzzy/types';
import { stepDateTime } from '@frozik/utils/date/stepDateTime';
import * as Popover from '@radix-ui/react-popover';
import { isNil } from 'lodash-es';
import type { ChangeEvent, KeyboardEvent, Ref } from 'react';
import { memo, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { useFunction } from '../../hooks/useFunction';
import { useIsCoarsePointer } from '../../hooks/useIsCoarsePointer';
import { cn } from '../cn';
import { CalendarPopup } from './components/CalendarPopup';
import { RichEditor } from './components/RichEditor';
import type { IRichEditorHandle, ISelection, TLeaveDirection } from './defs';
import {
  fromNativeInputValue,
  nativeInputStep,
  nativeInputType,
  toNativeInputBound,
  toNativeInputValue,
} from './native-picker';
import { getCalendarAriaLabels } from './translations/translations';
import styles from './styles.module.css';

const DEFAULT_TIME_ZONE = 'UTC';
const MIDNIGHT = new Temporal.PlainTime(0);
const POPOVER_SIDE_OFFSET = 4;

function formatDateOnly(value: Temporal.ZonedDateTime): string {
  return value.toPlainDate().toString();
}

/** `YYYY-MM-DD`, followed by the time down to the last non-zero unit. */
function defaultFormatDate(value: Temporal.ZonedDateTime): string {
  const dateTime = value.toPlainDateTime();
  const smallestUnit =
    dateTime.millisecond !== 0
      ? 'millisecond'
      : dateTime.second !== 0
        ? 'second'
        : dateTime.hour !== 0 || dateTime.minute !== 0
          ? 'minute'
          : undefined;

  return isNil(smallestUnit)
    ? formatDateOnly(value)
    : dateTime.toString({ smallestUnit }).replace('T', ' ');
}

export const DateTimePicker = memo(
  ({
    ref,
    className,
    value,
    onValueChange,
    timeZone = DEFAULT_TIME_ZONE,
    onParseInput,
    getDayInfo,
    startOfWeek,
    step = EDateTimeStep.Day,
    showTime = true,
    timeResolution,
    minDate,
    maxDate,
    formatDate,
    placeholder,
    today,
    disabled = false,
    locale = 'en',
    nativePicker = 'auto',
  }: {
    readonly ref?: Ref<IRichEditorHandle>;
    readonly className?: string;
    readonly value?: Temporal.ZonedDateTime;
    readonly onValueChange?: (value: Temporal.ZonedDateTime | undefined) => void;
    readonly timeZone?: string;
    readonly onParseInput: (text: string) => DateTimeParseResult;
    readonly getDayInfo?: (date: Temporal.PlainDate) => EDayType;
    readonly startOfWeek?: EDayOfWeek;
    readonly step?: EDateTimeStep;
    /** Date-only when off: the popup drops its clock and the field prints the day alone. */
    readonly showTime?: boolean;
    readonly timeResolution?: ETimeResolution;
    readonly minDate?: Temporal.PlainDate;
    readonly maxDate?: Temporal.PlainDate;
    readonly formatDate?: (value: Temporal.ZonedDateTime) => string;
    readonly placeholder?: string;
    readonly today?: Temporal.PlainDate;
    readonly disabled?: boolean;
    /** BCP-47 tag driving month and weekday names and the UI labels. */
    readonly locale?: string;
    /** A button opening the OS date picker: on coarse pointers only (`auto`), always, or never. */
    readonly nativePicker?: 'auto' | 'always' | 'never';
  }) => {
    const ariaLabels = useMemo(() => getCalendarAriaLabels(locale), [locale]);
    const format = formatDate ?? (showTime ? defaultFormatDate : formatDateOnly);
    const resolvedToday = useMemo(
      () => today ?? Temporal.Now.plainDateISO(timeZone),
      [today, timeZone]
    );

    const [focused, setFocused] = useState(false);
    const [popupFocused, setPopupFocused] = useState(false);
    const [popupFocusRequest, setPopupFocusRequest] = useState(0);
    const [fieldFocusRequest, setFieldFocusRequest] = useState(0);
    const [error, setError] = useState<string | undefined>(undefined);
    const [inputText, setInputText] = useState('');
    const cancelledRef = useRef(false);
    const editorRef = useRef<IRichEditorHandle>(null);
    const nativeInputRef = useRef<HTMLInputElement>(null);
    const isCoarsePointer = useIsCoarsePointer();

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editorRef.current?.focus(),
        focusNext: () => editorRef.current?.focusNext(),
      }),
      []
    );

    // Focus returns to the field after React committed the popup's selection, so
    // the focus handler formats the new value rather than the one before it.
    useEffect(() => {
      if (fieldFocusRequest > 0) {
        editorRef.current?.focus();
      }
    }, [fieldFocusRequest]);

    const popupOpen = (focused || popupFocused) && !disabled;

    const formattedValue = isNil(value) ? '' : format(value);
    // Invalid text stays visible after blur so the typo can be fixed.
    const displayText = focused || !isNil(error) ? inputText : formattedValue;

    const clampToRange = useFunction((dateTime: Temporal.ZonedDateTime) => {
      const date = dateTime.toPlainDate();

      if (!isNil(minDate) && Temporal.PlainDate.compare(date, minDate) < 0) {
        return minDate.toZonedDateTime({ timeZone, plainTime: dateTime.toPlainTime() });
      }
      if (!isNil(maxDate) && Temporal.PlainDate.compare(date, maxDate) > 0) {
        return maxDate.toZonedDateTime({ timeZone, plainTime: dateTime.toPlainTime() });
      }
      return dateTime;
    });

    // Commits emit only changes: leaving an untouched field must not re-emit its value.
    const commitValue = useFunction((next: Temporal.ZonedDateTime): Temporal.ZonedDateTime => {
      const clamped = clampToRange(next);
      setError(undefined);
      if (isNil(value) || Temporal.ZonedDateTime.compare(clamped, value) !== 0) {
        onValueChange?.(clamped);
      }
      return clamped;
    });

    const clearValue = useFunction(() => {
      setError(undefined);
      if (!isNil(value)) {
        onValueChange?.(undefined);
      }
    });

    const commitText = useFunction((text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        clearValue();
        return;
      }

      const result = onParseInput(trimmed);
      if (result.success) {
        setInputText(format(commitValue(result.value)));
      } else {
        setError(result.reason);
      }
    });

    const settle = useFunction(() => {
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      commitText(inputText);
    });

    const wasFocusedRef = useRef(false);
    useEffect(() => {
      if (wasFocusedRef.current && !focused) {
        settle();
      }
      wasFocusedRef.current = focused;
    }, [focused, settle]);

    const handleFocusChange = useFunction((nextFocused: boolean) => {
      if (nextFocused) {
        cancelledRef.current = false;
        setInputText(isNil(error) ? formattedValue : inputText);
      }
      setFocused(nextFocused);
    });

    const handleCancel = useFunction(() => {
      cancelledRef.current = true;
      setError(undefined);
      setInputText(formattedValue);
    });

    const handleFocusSelection = useFunction((currentValue: string): ISelection | undefined =>
      currentValue.length === 0 ? undefined : { start: 0, end: currentValue.length }
    );

    const handleKeyDown = useFunction((event: KeyboardEvent<HTMLDivElement>) => {
      const entersPopup =
        popupOpen &&
        ((event.key === 'Tab' && !event.shiftKey) || (event.key === 'ArrowDown' && event.altKey));
      if (entersPopup) {
        event.preventDefault();
        setPopupFocusRequest(previous => previous + 1);
        return;
      }

      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? 1 : -1;
      const base = value ?? resolvedToday.toZonedDateTime({ timeZone, plainTime: MIDNIGHT });
      setInputText(format(commitValue(stepDateTime(base, step, direction))));
    });

    const handleSelectCalendarDate = useFunction((date: Temporal.PlainDate) => {
      const plainTime = value?.toPlainTime() ?? MIDNIGHT;
      setInputText(format(commitValue(date.toZonedDateTime({ timeZone, plainTime }))));
    });

    const handleTimeChange = useFunction((plainTime: Temporal.PlainTime) => {
      const date = value?.toPlainDate() ?? resolvedToday;
      setInputText(format(commitValue(date.toZonedDateTime({ timeZone, plainTime }))));
    });

    const handleReturnToField = useFunction(() => {
      setFieldFocusRequest(previous => previous + 1);
    });

    const handlePopupLeave = useFunction((direction: TLeaveDirection) => {
      if (direction === 'forward') {
        editorRef.current?.focusNext();
      } else {
        handleReturnToField();
      }
    });

    const inputType = nativeInputType(showTime);
    const resolution = timeResolution ?? ETimeResolution.Minutes;
    const showsNativePicker =
      !disabled && (nativePicker === 'always' || (nativePicker === 'auto' && isCoarsePointer));

    const handleOpenNativePicker = useFunction(() => {
      nativeInputRef.current?.showPicker();
    });

    const handleNativeInputChange = useFunction((event: ChangeEvent<HTMLInputElement>) => {
      const picked = fromNativeInputValue(event.currentTarget.value, inputType, timeZone);
      if (isNil(picked)) {
        setInputText('');
        clearValue();
        return;
      }
      setInputText(format(commitValue(picked)));
    });

    const hasError = !isNil(error);
    const errorId = useId();

    return (
      <Popover.Root open={popupOpen}>
        <Popover.Anchor className={styles.field}>
          <RichEditor
            ref={editorRef}
            className={cn(
              styles.editor,
              hasError && styles.editorError,
              showsNativePicker && styles.editorWithPicker,
              className
            )}
            disabled={disabled}
            value={displayText}
            placeholder={placeholder}
            onValueChange={setInputText}
            onFocusChange={handleFocusChange}
            onFocusSelection={handleFocusSelection}
            onCancel={handleCancel}
            onKeyDown={handleKeyDown}
            aria-label={showTime ? ariaLabels.dateInputLabel : ariaLabels.dateOnlyInputLabel}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
          />
          {showsNativePicker && (
            <div className={styles.nativePicker}>
              <input
                ref={nativeInputRef}
                type={inputType}
                className={styles.nativePickerInput}
                tabIndex={-1}
                aria-hidden="true"
                value={toNativeInputValue(value, inputType, resolution)}
                min={toNativeInputBound(minDate, inputType)}
                max={toNativeInputBound(maxDate, inputType)}
                step={inputType === 'date' ? undefined : nativeInputStep(resolution)}
                onChange={handleNativeInputChange}
              />
              <button
                type="button"
                className={styles.nativePickerButton}
                aria-label={ariaLabels.openNativePicker}
                onClick={handleOpenNativePicker}
              >
                📅
              </button>
            </div>
          )}
          {hasError && (
            <div id={errorId} className={styles.errorTooltip} role="alert">
              {error}
            </div>
          )}
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            className={styles.popoverLayer}
            sideOffset={POPOVER_SIDE_OFFSET}
            onOpenAutoFocus={preventFocusSteal}
            onCloseAutoFocus={preventFocusSteal}
          >
            <CalendarPopup
              value={value?.toPlainDate()}
              time={value?.toPlainTime() ?? MIDNIGHT}
              today={resolvedToday}
              getDayInfo={getDayInfo}
              startOfWeek={startOfWeek}
              showTime={showTime}
              timeResolution={timeResolution}
              minDate={minDate}
              maxDate={maxDate}
              focusRequest={popupFocusRequest}
              onSelectDate={handleSelectCalendarDate}
              onTimeChange={handleTimeChange}
              onFocusWithinChange={setPopupFocused}
              onLeave={handlePopupLeave}
              onReturnToField={handleReturnToField}
              locale={locale}
              ariaLabels={ariaLabels}
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
