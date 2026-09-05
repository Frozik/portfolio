import { clamp, isNil } from 'lodash-es';
import type { KeyboardEvent, Ref } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { useFunction } from '../../hooks/useFunction';
import { cn } from '../cn';
import { RichEditor } from './components/RichEditor';
import type { IRichEditorHandle, ISelection } from './defs';
import {
  createNumericHtmlRenderer,
  createNumericInputNormalizer,
  formatNumericValue,
  parseNumericText,
  roundNumericText,
  settleNumericText,
} from './numeric-input';
import styles from './styles.module.scss';
import { getCalendarAriaLabels } from './translations/translations';

const DEFAULT_PIP_SIZE = 2;

export const NumericEditor = memo(
  ({
    ref,
    className,
    value,
    onValueChange,
    decimal,
    pipStart,
    pipSize = DEFAULT_PIP_SIZE,
    allowNegative = false,
    min,
    max,
    step,
    placeholder,
    disabled = false,
    locale = 'en',
  }: {
    readonly ref?: Ref<IRichEditorHandle>;
    readonly className?: string;
    readonly value?: number;
    readonly onValueChange?: (value: number | undefined) => void;
    /** Fraction digits the value settles to on blur; unlimited when absent. */
    readonly decimal?: number;
    readonly pipStart?: number;
    readonly pipSize?: number;
    readonly allowNegative?: boolean;
    readonly min?: number;
    readonly max?: number;
    /** Enables ArrowUp / ArrowDown stepping. */
    readonly step?: number;
    readonly placeholder?: string;
    readonly disabled?: boolean;
    readonly locale?: string;
  }) => {
    const ariaLabels = useMemo(() => getCalendarAriaLabels(locale), [locale]);
    const decimals = isNil(decimal) ? undefined : Math.max(decimal, 0);
    const displayScale = Math.max(decimals ?? 0, isNil(pipStart) ? 0 : pipStart + pipSize);

    const [editingText, setEditingText] = useState(() => formatNumericValue(value));
    const [focused, setFocused] = useState(false);
    // Mirrors the last value emitted through `onValueChange` so prop changes that
    // merely echo our own commit don't fight the editing buffer.
    const lastEmittedValueRef = useRef(value);
    const valueBeforeEditRef = useRef(value);

    useEffect(() => {
      if (focused || value === lastEmittedValueRef.current) {
        return;
      }
      lastEmittedValueRef.current = value;
      setEditingText(formatNumericValue(value));
    }, [value, focused]);

    const commitText = useFunction((nextText: string) => {
      setEditingText(nextText);

      const nextValue = parseNumericText(nextText);
      if (nextValue !== lastEmittedValueRef.current) {
        lastEmittedValueRef.current = nextValue;
        onValueChange?.(nextValue);
      }
    });

    const settle = useFunction(() => {
      const settled = settleNumericText(editingText, {
        decimals: isNil(decimals) && isNil(pipStart) ? undefined : displayScale,
        min,
        max,
      });
      if (settled !== editingText) {
        commitText(settled);
      }
    });

    const wasFocusedRef = useRef(false);
    useEffect(() => {
      if (wasFocusedRef.current && !focused) {
        settle();
      }
      wasFocusedRef.current = focused;
    }, [focused, settle]);

    const normalizeInput = useMemo(
      () => createNumericInputNormalizer({ allowNegative }),
      [allowNegative]
    );

    const toHtml = useMemo(
      () => createNumericHtmlRenderer({ decimal: decimals, pipStart, pipSize }),
      [decimals, pipStart, pipSize]
    );

    const handleFocusSelection = useFunction((currentValue: string): ISelection | undefined => {
      if (isNil(pipStart) || currentValue.length === 0) {
        return undefined;
      }

      const decimalIndex = currentValue.indexOf('.');
      const integerLength = decimalIndex >= 0 ? decimalIndex : currentValue.length;
      const selectionStart = integerLength + pipStart;
      if (selectionStart > currentValue.length) {
        return undefined;
      }

      return {
        start: selectionStart,
        end: Math.min(selectionStart + pipSize, currentValue.length),
      };
    });

    const handleFocusChange = useFunction((nextFocused: boolean) => {
      if (nextFocused) {
        valueBeforeEditRef.current = value;
      }
      setFocused(nextFocused);
    });

    const handleCancel = useFunction(() => {
      commitText(formatNumericValue(valueBeforeEditRef.current));
    });

    const handleKeyDown = useFunction((event: KeyboardEvent<HTMLDivElement>) => {
      if (isNil(step) || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
        return;
      }

      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? 1 : -1;
      const stepped = clamp(
        (parseNumericText(editingText) ?? 0) + direction * step,
        min ?? Number.NEGATIVE_INFINITY,
        max ?? Number.POSITIVE_INFINITY
      );
      const steppedText = formatNumericValue(stepped);
      commitText(isNil(decimals) ? steppedText : roundNumericText(steppedText, decimals));
    });

    return (
      <RichEditor
        ref={ref}
        className={cn(styles.editor, className)}
        disabled={disabled}
        value={editingText}
        placeholder={placeholder}
        inputMode={allowNegative || displayScale > 0 || isNil(decimals) ? 'decimal' : 'numeric'}
        normalizeInput={normalizeInput}
        toHtml={toHtml}
        onValueChange={commitText}
        onFocusChange={handleFocusChange}
        onFocusSelection={handleFocusSelection}
        onCancel={handleCancel}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabels.numericInputLabel}
      />
    );
  }
);
