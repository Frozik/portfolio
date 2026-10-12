import { isNil } from 'lodash-es';
import type { ChangeEvent, KeyboardEvent, ReactNode, Ref } from 'react';
import { memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '../cn';
import type { IRichEditorHandle } from './defs';
import { findNextTabStop } from './focus-navigation';
import { SECRET_FIELD_ATTRIBUTES } from './secret-attributes';
import type { ISecretInputFormat } from './secret-input';
import { normalizeSecretInput } from './secret-input';
import { getCalendarAriaLabels } from './translations/translations';
import controlTokens from '../control-tokens.module.css';
import styles from './styles.module.css';

const FREE_TEXT: ISecretInputFormat = {};

/** An `<input>` adds what only inputs know to the shared secret attributes. */
const SECRET_INPUT_ATTRIBUTES = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  ...SECRET_FIELD_ATTRIBUTES,
} as const;

/**
 * A secret field on a native `<input type="password">`,
 * on purpose not on the family's contentEditable: only `type="password"`
 * tells the browser, the on-screen keyboard and the IME that the text is a
 * secret (no learning, no suggestions, no screen reader echo). The contract
 * is the family's: `value` / `onValueChange`, Escape reverts, Enter moves on,
 * the same handle and tokens. It has no agent tools, deliberately.
 */
export const SecretEditor = memo(
  ({
    ref,
    className,
    value = '',
    onValueChange,
    format = FREE_TEXT,
    placeholder,
    disabled = false,
    locale = 'en',
    revealTimeoutMs,
    autoComplete = 'off',
    onEnter,
    adornments,
    'aria-label': ariaLabel,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
  }: {
    readonly ref?: Ref<IRichEditorHandle>;
    readonly className?: string;
    readonly value?: string;
    readonly onValueChange?: (value: string) => void;
    readonly format?: ISecretInputFormat;
    readonly placeholder?: string;
    readonly disabled?: boolean;
    readonly locale?: string;
    /** Hides a shown value again after this long; the owner sets the policy. */
    readonly revealTimeoutMs?: number;
    /** Only a master password may be offered to the browser's password manager. */
    readonly autoComplete?: 'off' | 'current-password' | 'new-password';
    /** Enter submits instead of moving on: the unlock field. */
    readonly onEnter?: () => void;
    /** The owner's buttons beside the field: generator, copy, a strength meter. */
    readonly adornments?: ReactNode;
    readonly 'aria-label'?: string;
    readonly 'aria-invalid'?: boolean;
    readonly 'aria-describedby'?: string;
  }) => {
    const labels = useMemo(() => getCalendarAriaLabels(locale), [locale]);
    const inputRef = useRef<HTMLInputElement>(null);
    const valueBeforeEditRef = useRef(value);
    const [revealed, setRevealed] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        focusNext: () => {
          const input = inputRef.current;
          const next = isNil(input) ? undefined : findNextTabStop(input);
          if (isNil(next)) {
            input?.blur();
          } else {
            next.focus();
          }
        },
      }),
      []
    );

    useEffect(() => {
      if (!revealed || isNil(revealTimeoutMs)) {
        return undefined;
      }
      const timer = setTimeout(() => setRevealed(false), revealTimeoutMs);
      return () => clearTimeout(timer);
    }, [revealed, revealTimeoutMs]);

    const handleChange = useEventCallback((event: ChangeEvent<HTMLInputElement>) => {
      const next = normalizeSecretInput(event.target.value, format);
      if (!isNil(next) && next !== value) {
        onValueChange?.(next);
      }
    });

    const handleFocus = useEventCallback(() => {
      valueBeforeEditRef.current = value;
    });

    const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (valueBeforeEditRef.current !== value) {
          onValueChange?.(valueBeforeEditRef.current);
        }
        inputRef.current?.blur();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (!isNil(onEnter)) {
          onEnter();
          return;
        }
        const next = isNil(inputRef.current) ? undefined : findNextTabStop(inputRef.current);
        next?.focus();
      }
    });

    const toggle = useEventCallback(() => setRevealed(current => !current));

    return (
      <div className={cn(controlTokens.tokens, styles.editor, styles.secretField, className)}>
        <input
          {...SECRET_INPUT_ATTRIBUTES}
          autoComplete={autoComplete}
          ref={inputRef}
          className={styles.secretInput}
          type={revealed ? 'text' : 'password'}
          inputMode={format.digitsOnly === true ? 'numeric' : 'text'}
          enterKeyHint="next"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel ?? labels.secretInputLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
        />
        {adornments}
        <button
          type="button"
          className={styles.secretToggle}
          aria-pressed={revealed}
          disabled={disabled}
          onClick={toggle}
        >
          {revealed ? labels.hideSecret : labels.showSecret}
        </button>
      </div>
    );
  }
);
