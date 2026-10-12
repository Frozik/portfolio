import type { Ref } from 'react';
import { memo, useMemo } from 'react';

import { cn } from '../cn';
import { RichEditor } from './components/RichEditor';
import type { IRichEditorHandle } from './defs';
import type { TMask } from './masked-input';
import { createMaskNormalizer, createMaskSegmentRenderer } from './masked-input';
import { useRevertOnCancel } from './use-revert-on-cancel';
import controlTokens from '../control-tokens.module.css';
import styles from './styles.module.css';

/**
 * A RichEditor that takes only what its mask accepts and
 * shows groups as spacing. The value has no separators; pasted
 * `4111 1111-1111 1111` arrives as `4111111111111111`. Checksums (Luhn,
 * mod 97) are the owner's business: it passes `aria-invalid` and a hint.
 */
export const MaskedEditor = memo(
  ({
    ref,
    className,
    value = '',
    onValueChange,
    mask,
    inputMode = 'text',
    placeholder,
    disabled = false,
    secret = false,
    'aria-label': ariaLabel,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
  }: {
    readonly ref?: Ref<IRichEditorHandle>;
    readonly className?: string;
    readonly value?: string;
    readonly onValueChange?: (value: string) => void;
    readonly mask: TMask;
    readonly inputMode?: 'text' | 'numeric' | 'email';
    readonly placeholder?: string;
    readonly disabled?: boolean;
    /** A number that is a secret (a card number): the field carries the secret attributes of. */
    readonly secret?: boolean;
    readonly 'aria-label'?: string;
    readonly 'aria-invalid'?: boolean;
    readonly 'aria-describedby'?: string;
  }) => {
    const { rememberOnFocus, cancel } = useRevertOnCancel(value, onValueChange);
    const normalizeInput = useMemo(() => createMaskNormalizer(mask), [mask]);
    const toSegments = useMemo(() => createMaskSegmentRenderer(mask, styles.maskGap ?? ''), [mask]);

    return (
      <RichEditor
        ref={ref}
        className={cn(controlTokens.tokens, styles.editor, className)}
        value={value}
        onValueChange={onValueChange}
        normalizeInput={normalizeInput}
        toSegments={toSegments}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        secret={secret}
        onFocusChange={rememberOnFocus}
        onCancel={cancel}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
    );
  }
);
