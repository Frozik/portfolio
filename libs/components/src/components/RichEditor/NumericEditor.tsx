import { trim } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { memo, useEffect, useMemo, useState } from 'react';
import { useFunction } from '../../hooks/useFunction';
import { cn } from '../cn';
import type { ISelection } from './defs';
import { RichEditor } from './RichEditor';
import styles from './styles.module.scss';
import { numericElementSelectionWithValueBuilder, numericTextToHtmlBuilder } from './utils';

export const NumericEditor = memo(
  ({
    className,
    decimal,
    pipStart,
    pipSize = 2,
    allowNegative = false,
    placeholder,
  }: {
    className?: string;
    decimal?: number;
    pipStart?: number;
    pipSize?: number;
    allowNegative?: boolean;
    placeholder?: string;
  }) => {
    const allowedDecimals = useMemo(
      () => (isNil(decimal) ? decimal : Math.max(decimal, 0)),
      [decimal]
    );

    const [value, setValue] = useState('');
    const [focused, setFocused] = useState(false);

    const handleElementSelectionWithValue = useMemo(
      () => numericElementSelectionWithValueBuilder({ allowNegative }),
      [allowNegative]
    );

    const handleTextToHtml = useMemo(
      () =>
        numericTextToHtmlBuilder({
          decimal: allowedDecimals,
          pipStart,
          pipSize,
        }),
      [allowedDecimals, pipStart, pipSize]
    );

    const handleFocusSelection = useFunction((currentValue: string): ISelection | undefined => {
      if (isNil(pipStart) || currentValue.length === 0) {
        return undefined;
      }

      const decimalIndex = currentValue.indexOf('.');
      const integerLength = decimalIndex >= 0 ? decimalIndex : currentValue.length;
      const selectionStart = integerLength + pipStart;
      const selectionEnd = selectionStart + pipSize;

      if (selectionStart > currentValue.length) {
        return undefined;
      }

      return {
        start: Math.min(selectionStart, currentValue.length),
        end: Math.min(selectionEnd, currentValue.length),
      };
    });

    const handleFocusChanges = useFunction((newFocused: boolean) => {
      setFocused(newFocused);

      if (newFocused || !value.includes('.')) {
        return;
      }

      if (!isNil(allowedDecimals) || !isNil(pipStart)) {
        const newValue = trim(
          value,
          Math.max(allowedDecimals ?? 0, isNil(pipStart) ? 0 : pipStart + pipSize)
        );

        if (newValue !== value) {
          setValue(newValue);
        }
      } else {
        setValue(value.replace(/0+$/g, ''));
      }
    });

    useEffect(() => {
      handleFocusChanges(focused);
    }, [handleFocusChanges, focused]);

    return (
      <RichEditor
        className={cn(styles.editor, className)}
        onGetElementSelectionWithValue={handleElementSelectionWithValue}
        onTextToHtml={handleTextToHtml}
        value={value}
        placeholder={`<span class="${styles.placeholder}">${placeholder}</span>`}
        onValueChanged={setValue}
        onFocusChanges={handleFocusChanges}
        onFocusSelection={handleFocusSelection}
      />
    );
  }
);
