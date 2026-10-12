import type { Ref } from 'react';
import { memo, useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useEventCallback } from 'usehooks-ts';

import { useIsCoarsePointer } from '../../hooks/useIsCoarsePointer';
import { cn } from '../cn';
import { FieldPopup } from '../popup/FieldPopup';
import { MonthYearPopup } from './components/MonthYearPopup';
import { RichEditor } from './components/RichEditor';
import type { IRichEditorHandle } from './defs';
import { formatMonthYear, normalizeMonthYearInput, parseMonthYear } from './month-year-input';
import { getCalendarAriaLabels } from './translations/translations';
import { useRevertOnCancel } from './use-revert-on-cancel';
import controlTokens from '../control-tokens.module.css';
import styles from './styles.module.css';

/**
 * A month of a year as `MM/YY` (a card's expiry). Typing
 * is the quick way; on a fine pointer the months of a year peek out under the
 * field. On touch the numeric keyboard is all: four digits beat a sheet.
 */
export const MonthYearEditor = memo(
  ({
    ref,
    className,
    value,
    onValueChange,
    placeholder = 'MM/YY',
    disabled = false,
    locale = 'en',
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
  }: {
    readonly ref?: Ref<IRichEditorHandle>;
    readonly className?: string;
    readonly value: Temporal.PlainYearMonth | undefined;
    readonly onValueChange: (value: Temporal.PlainYearMonth | undefined) => void;
    readonly placeholder?: string;
    readonly disabled?: boolean;
    readonly locale?: string;
    readonly 'aria-label'?: string;
    readonly 'aria-describedby'?: string;
  }) => {
    const labels = useMemo(() => getCalendarAriaLabels(locale), [locale]);
    const isCoarsePointer = useIsCoarsePointer();
    const [focused, setFocused] = useState(false);
    const [text, setText] = useState('');
    const { rememberOnFocus, cancel } = useRevertOnCancel(value, onValueChange);
    const shownText = focused ? text : formatMonthYear(value);
    const parsed = parseMonthYear(shownText);

    const handleFocusChange = useEventCallback((nextFocused: boolean) => {
      rememberOnFocus(nextFocused);
      if (nextFocused) {
        setText(formatMonthYear(value));
      }
      setFocused(nextFocused);
    });
    const handleTextChange = useEventCallback((next: string) => {
      setText(next);
      const result = parseMonthYear(next);
      if (result.kind === 'value') {
        onValueChange(result.value);
      } else if (result.kind === 'empty') {
        onValueChange(undefined);
      }
    });
    const handleSelect = useEventCallback((month: Temporal.PlainYearMonth) => {
      setText(formatMonthYear(month));
      onValueChange(month);
    });

    return (
      <FieldPopup
        open={focused && !isCoarsePointer && !disabled}
        held={false}
        sheet={undefined}
        handleLabel={labels.monthPicker}
        className={cn(controlTokens.tokens, styles.field)}
        field={
          <RichEditor
            ref={ref}
            className={cn(
              controlTokens.tokens,
              styles.editor,
              parsed.kind === 'invalid' && styles.editorError,
              className
            )}
            value={shownText}
            onValueChange={handleTextChange}
            normalizeInput={normalizeMonthYearInput}
            inputMode="numeric"
            placeholder={placeholder}
            disabled={disabled}
            onFocusChange={handleFocusChange}
            onCancel={cancel}
            aria-label={ariaLabel ?? labels.monthYearInputLabel}
            aria-invalid={parsed.kind === 'invalid'}
            aria-describedby={ariaDescribedBy}
          />
        }
      >
        <MonthYearPopup
          key={value?.year}
          value={value}
          initialYear={Temporal.Now.plainDateISO().year}
          locale={locale}
          ariaLabels={labels}
          onSelect={handleSelect}
        />
      </FieldPopup>
    );
  }
);
