import { isNil } from 'lodash-es';
import type { ChangeEvent, KeyboardEvent, Ref } from 'react';
import { memo, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '../cn';
import type { IRichEditorHandle } from './defs';
import { findNextTabStop } from './focus-navigation';
import { multilineHeight } from './multiline-height';
import { useRevertOnCancel } from './use-revert-on-cancel';
import styles from './styles.module.css';

const DEFAULT_MAX_ROWS = 12;

/**
 * Several lines of text on a `<textarea>` that grows with
 * them. Enter starts a line; Ctrl or Cmd with Enter moves on, as Enter does
 * in the one-line fields; Escape puts the text back. Spell checking is off:
 * a note may hold a secret, and the enhanced checker sends text away.
 */
export const MultilineEditor = memo(
  ({
    ref,
    className,
    value = '',
    onValueChange,
    placeholder,
    disabled = false,
    maxRows = DEFAULT_MAX_ROWS,
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
    readonly maxRows?: number;
    readonly 'aria-label'?: string;
    readonly 'aria-invalid'?: boolean;
    readonly 'aria-describedby'?: string;
  }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { rememberOnFocus, cancel } = useRevertOnCancel(value, onValueChange);
    const moveOn = useEventCallback(() => {
      const textarea = textareaRef.current;
      const next = isNil(textarea) ? undefined : findNextTabStop(textarea);
      if (isNil(next)) {
        textarea?.blur();
      } else {
        next.focus();
      }
    });

    useImperativeHandle(
      ref,
      () => ({ focus: () => textareaRef.current?.focus(), focusNext: moveOn }),
      [moveOn]
    );

    useLayoutEffect(() => {
      const textarea = textareaRef.current;
      if (isNil(textarea)) {
        return;
      }
      const style = getComputedStyle(textarea);
      const pixels = (value: string) => Number.parseFloat(value) || 0;
      textarea.style.height = 'auto';
      const { height, overflows } = multilineHeight({
        scrollHeight: textarea.scrollHeight,
        lineHeight: pixels(style.lineHeight),
        paddingY: pixels(style.paddingTop) + pixels(style.paddingBottom),
        borderY: pixels(style.borderTopWidth) + pixels(style.borderBottomWidth),
        maxRows,
      });
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = overflows ? 'auto' : 'hidden';
    }, [value, maxRows]);

    const handleChange = useEventCallback((event: ChangeEvent<HTMLTextAreaElement>) =>
      onValueChange?.(event.target.value)
    );
    const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
        textareaRef.current?.blur();
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        moveOn();
      }
    });

    return (
      <textarea
        ref={textareaRef}
        className={cn(styles.editor, styles.multiline, className)}
        rows={1}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        data-enable-grammarly="false"
        onChange={handleChange}
        onFocus={() => rememberOnFocus(true)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
    );
  }
);
