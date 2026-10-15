import { cn } from '@frozik/components/components/cn';
import { memo } from 'react';

import { SENSITIVE_CLASS } from '../sensitive-class';
import styles from './large-type.module.css';
import controlTokens from '@frozik/components/components/control-tokens.module.css';

const DIGIT = /^\p{Nd}$/u;
const LETTER = /^\p{L}$/u;
/** A space would be invisible in a cell; the open-box sign stands for it. */
const SPACE_SIGN = '␣';

function classOf(character: string): string {
  if (DIGIT.test(character)) {
    return `${styles.character} ${styles.digit}`;
  }
  return LETTER.test(character) ? styles.character : `${styles.character} ${styles.symbol}`;
}

/** A character's place is its identity — the same letter repeats — and the place is what the cell shows. */
function cellsOf(
  value: string
): readonly { readonly position: number; readonly character: string }[] {
  return [...value].map((character, index) => ({ position: index + 1, character }));
}

/**
 * "large type" (1Password's): a secret written out to be
 * typed on another device — big, monospaced, digits and symbols in their own
 * colours, every position numbered. Split by code point, so an emoji is one cell.
 */
export const LargeTypeView = memo(
  ({
    value,
    'aria-label': ariaLabel,
  }: {
    readonly value: string;
    readonly 'aria-label': string;
  }) => (
    <ol className={cn(controlTokens.tokens, styles.grid, SENSITIVE_CLASS)} aria-label={ariaLabel}>
      {cellsOf(value).map(({ position, character }) => (
        <li key={position} className={styles.cell}>
          <span className={classOf(character)}>{character === ' ' ? SPACE_SIGN : character}</span>
          <span className={styles.position}>{position}</span>
        </li>
      ))}
    </ol>
  )
);
