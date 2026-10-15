import { cn } from '@frozik/components/components/cn';
import { Delete } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';
import controlTokens from '@frozik/components/components/control-tokens.module.css';

import { getVaultReactTranslations } from '../translations/translations';
import styles from './pin-pad.module.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0'] as const;
const ERASE_ICON_SIZE = 20;
const DIGIT = /^\d$/;

/**
 * A PIN of a known length: digits from the pad or the keyboard, sent the
 * moment the last one is in. The digits never show, only how many there are.
 */
export const PinPad = memo(
  ({
    length,
    locale,
    disabled = false,
    onComplete,
  }: {
    readonly length: number;
    readonly locale: string;
    readonly disabled?: boolean;
    readonly onComplete: (digits: string) => void;
  }) => {
    const t = getVaultReactTranslations(locale).pinPad;
    const [digits, setDigits] = useState('');
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
      root.current?.focus();
    }, []);

    const add = useEventCallback((digit: string) => {
      if (disabled || digits.length >= length) {
        return;
      }
      const next = digits + digit;
      if (next.length === length) {
        setDigits('');
        onComplete(next);
      } else {
        setDigits(next);
      }
    });
    const erase = useEventCallback(() => setDigits(current => current.slice(0, -1)));
    const keyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
      if (DIGIT.test(event.key)) {
        event.preventDefault();
        add(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        erase();
      }
    });

    return (
      <div
        ref={root}
        role="group"
        aria-label={t.label}
        tabIndex={-1}
        data-testid="pin-pad"
        className={cn(controlTokens.tokens, styles.pad)}
        onKeyDown={keyDown}
      >
        <div
          className={styles.dots}
          role="status"
          aria-label={t.entered(digits.length, length)}
          data-entered={digits.length}
        >
          {Array.from({ length }, (_, index) => (
            <span key={index} className={styles.dot} data-filled={index < digits.length} />
          ))}
        </div>
        <div className={styles.keys}>
          {KEYS.map((key, index) =>
            key === '' ? (
              <span key={`gap-${index}`} />
            ) : (
              <button
                key={key}
                type="button"
                className={styles.key}
                disabled={disabled}
                onClick={() => add(key)}
              >
                {key}
              </button>
            )
          )}
          <button
            type="button"
            className={styles.key}
            aria-label={t.erase}
            disabled={disabled || digits === ''}
            onClick={erase}
          >
            <Delete size={ERASE_ICON_SIZE} aria-hidden />
          </button>
        </div>
      </div>
    );
  }
);
