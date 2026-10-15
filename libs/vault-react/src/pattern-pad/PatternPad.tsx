import { cn } from '@frozik/components/components/cn';
import { isNil } from 'lodash-es';
import type { KeyboardEvent, PointerEvent } from 'react';
import { memo, useId, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';
import controlTokens from '@frozik/components/components/control-tokens.module.css';

import { getVaultReactTranslations } from '../translations/translations';
import { catchesPoint } from './point-catch';
import styles from './pattern-pad.module.css';

const SIDE = 3;
const POINTS = Array.from({ length: SIDE * SIDE }, (_, index) => index);
/** Where a point's centre sits in the drawing, in the SVG's 0–300 box. */
const CELL = 100;
const HALF_CELL = CELL / 2;
const MOVES: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -SIDE,
  ArrowDown: SIDE,
};

function centre(point: number): string {
  const x = (point % SIDE) * CELL + HALF_CELL;
  const y = Math.floor(point / SIDE) * CELL + HALF_CELL;
  return `${x},${y}`;
}

/**
 * A 3×3 pattern drawn with a pointer — down, across the points, up — or
 * with the keyboard: arrows move, Space joins the focused point, Enter
 * finishes. The joined points go to `onComplete` as touched; the rules
 * (passes, repeats, length) are the caller's. `hideLine` draws nothing.
 */
export const PatternPad = memo(
  ({
    locale,
    hideLine = false,
    disabled = false,
    onComplete,
  }: {
    readonly locale: string;
    readonly hideLine?: boolean;
    readonly disabled?: boolean;
    readonly onComplete: (points: readonly number[]) => void;
  }) => {
    const t = getVaultReactTranslations(locale).patternPad;
    const [joined, setJoined] = useState<readonly number[]>([]);
    const [drawing, setDrawing] = useState(false);
    /** Where the pointer is in the drawing while it draws: the line runs on to it from the last point. */
    const [pointer, setPointer] = useState<string | null>(null);
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const hintId = useId();

    const join = useEventCallback((point: number) => {
      setJoined(current => (current.at(-1) === point ? current : [...current, point]));
    });
    const finish = useEventCallback(() => {
      setDrawing(false);
      setPointer(null);
      if (joined.length > 0) {
        onComplete(joined);
      }
      setJoined([]);
    });
    const pointAt = (x: number, y: number): number | null => {
      const hit = buttons.current.findIndex(
        button => !isNil(button) && catchesPoint(button.getBoundingClientRect(), x, y)
      );
      return hit === -1 ? null : hit;
    };

    const pointerDown = useEventCallback((event: PointerEvent<HTMLDivElement>) => {
      const point = pointAt(event.clientX, event.clientY);
      if (disabled || isNil(point)) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrawing(true);
      setJoined([point]);
    });
    const pointerMove = useEventCallback((event: PointerEvent<HTMLDivElement>) => {
      if (!drawing) {
        return;
      }
      const point = pointAt(event.clientX, event.clientY);
      if (!isNil(point)) {
        join(point);
      }
      const pad = event.currentTarget.getBoundingClientRect();
      if (pad.width > 0 && pad.height > 0) {
        const x = Math.round(((event.clientX - pad.left) / pad.width) * SIDE * CELL);
        const y = Math.round(((event.clientY - pad.top) / pad.height) * SIDE * CELL);
        setPointer(`${x},${y}`);
      }
    });
    const keyDown = useEventCallback((event: KeyboardEvent<HTMLButtonElement>, point: number) => {
      const move = MOVES[event.key];
      if (!isNil(move)) {
        event.preventDefault();
        buttons.current[(point + move + POINTS.length) % POINTS.length]?.focus();
      } else if (event.key === ' ') {
        event.preventDefault();
        join(point);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        finish();
      }
    });

    return (
      <div
        role="group"
        aria-label={t.label}
        aria-describedby={hintId}
        data-testid="pattern-pad"
        data-hide-line={hideLine}
        className={cn(controlTokens.tokens, styles.pad)}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={finish}
        onPointerCancel={() => {
          setJoined([]);
          setPointer(null);
        }}
      >
        <span id={hintId} className={styles.hint}>
          {t.hint}
        </span>
        {!hideLine && (joined.length > 1 || (joined.length > 0 && !isNil(pointer))) && (
          <svg className={styles.line} viewBox={`0 0 ${SIDE * CELL} ${SIDE * CELL}`} aria-hidden>
            <polyline
              data-testid="pattern-line"
              points={[...joined.map(centre), ...(isNil(pointer) ? [] : [pointer])].join(' ')}
            />
          </svg>
        )}
        {POINTS.map(point => (
          <button
            key={point}
            ref={button => {
              buttons.current[point] = button;
            }}
            type="button"
            className={styles.point}
            aria-label={t.point(Math.floor(point / SIDE) + 1, (point % SIDE) + 1)}
            aria-pressed={joined.includes(point)}
            data-state={joined.includes(point) ? 'joined' : 'free'}
            disabled={disabled}
            onKeyDown={event => keyDown(event, point)}
          >
            <span className={styles.dot} />
          </button>
        ))}
      </div>
    );
  }
);
