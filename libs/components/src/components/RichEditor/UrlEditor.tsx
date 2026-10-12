import { isNil } from 'lodash-es';
import type { Ref } from 'react';
import { memo, useMemo } from 'react';

import { cn } from '../cn';
import { RichEditor } from './components/RichEditor';
import type { IRichEditorHandle, TSegmentRenderer } from './defs';
import { normalizeUrlInput, punycodeHostOf, urlSegments } from './url-input';
import { useRevertOnCancel } from './use-revert-on-cancel';
import controlTokens from '../control-tokens.module.css';
import styles from './styles.module.css';

/**
 * An address field that shows which site it leads to: the
 * host bright, the rest dimmed, so a look-alike or `user@host` trick shows;
 * an internationalised host also shows the ASCII name it really resolves to.
 */
export const UrlEditor = memo(
  ({
    ref,
    className,
    value = '',
    onValueChange,
    placeholder,
    disabled = false,
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
    readonly 'aria-label'?: string;
    readonly 'aria-invalid'?: boolean;
    readonly 'aria-describedby'?: string;
  }) => {
    const { rememberOnFocus, cancel } = useRevertOnCancel(value, onValueChange);
    const toSegments = useMemo<TSegmentRenderer>(
      () => text => urlSegments(text, { dim: styles.urlDim ?? '', host: styles.urlHost ?? '' }),
      []
    );
    const punycodeHost = punycodeHostOf(value);
    return (
      <div className={cn(controlTokens.tokens, styles.urlField)}>
        <RichEditor
          ref={ref}
          className={cn(controlTokens.tokens, styles.editor, className)}
          value={value}
          onValueChange={onValueChange}
          normalizeInput={normalizeUrlInput}
          toSegments={toSegments}
          inputMode="url"
          placeholder={placeholder}
          disabled={disabled}
          onFocusChange={rememberOnFocus}
          onCancel={cancel}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
        />
        {!isNil(punycodeHost) && <span className={styles.urlPunycode}>{punycodeHost}</span>}
      </div>
    );
  }
);
