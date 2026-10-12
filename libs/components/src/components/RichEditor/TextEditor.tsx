import type { Ref } from 'react';
import { memo } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '../cn';
import { RichEditor } from './components/RichEditor';
import type { IRichEditorHandle } from './defs';
import { useRevertOnCancel } from './use-revert-on-cancel';
import controlTokens from '../control-tokens.module.css';
import styles from './styles.module.css';

/**
 * One line of plain text in the family's frame: the
 * `RichEditor` primitive as a form field, Escape bringing back the value it
 * had on focus. Fills the width its container gives it.
 */
export const TextEditor = memo(
  ({
    ref,
    className,
    value = '',
    onValueChange,
    placeholder,
    disabled = false,
    inputMode = 'text',
    enterKeyHint,
    onFocusChange,
    'aria-label': ariaLabel,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
  }: {
    readonly ref?: Ref<IRichEditorHandle>;
    readonly className?: string;
    readonly value?: string;
    readonly onValueChange?: (value: string) => void;
    readonly placeholder?: string;
    readonly disabled?: boolean;
    readonly inputMode?: 'text' | 'email';
    readonly enterKeyHint?: 'next' | 'done';
    readonly onFocusChange?: (focused: boolean) => void;
    readonly 'aria-label'?: string;
    readonly 'aria-invalid'?: boolean;
    readonly 'aria-describedby'?: string;
  }) => {
    const { rememberOnFocus, cancel } = useRevertOnCancel(value, onValueChange);
    const handleFocusChange = useEventCallback((focused: boolean) => {
      rememberOnFocus(focused);
      onFocusChange?.(focused);
    });
    return (
      <RichEditor
        ref={ref}
        className={cn(controlTokens.tokens, styles.editor, className)}
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        onFocusChange={handleFocusChange}
        onCancel={cancel}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
    );
  }
);
