import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { memo, useEffect, useRef, useState } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { ElevationMark } from '../../domain/model/site-plan';
import type { Meters } from '../../domain/units';
import { planToScreen } from '../../domain/view/plan-viewport';
import { sitePlannerT } from '../translations';

const COMMIT_KEY = 'Enter';
const CANCEL_KEY = 'Escape';
const DECIMAL_COMMA = ',';
const DECIMAL_POINT = '.';
/** Room for a signed value with two decimals, and no more. */
const INPUT_MAX_LENGTH = 8;
/** Lifts the field clear of the flag it belongs to. */
const OFFSET_ABOVE_MARK_PX = 34;

/** A comma is what a Russian keyboard puts in a decimal, and it means the same here. */
function parseElevation(text: string): Meters | undefined {
  const value = Number(text.trim().replace(DECIMAL_COMMA, DECIMAL_POINT));

  return Number.isFinite(value) ? value : undefined;
}

const ElevationField = memo(
  ({
    mark,
    screenPoint,
    onApply,
    onCancel,
  }: {
    readonly mark: ElevationMark;
    readonly screenPoint: { readonly x: number; readonly y: number };
    readonly onApply: (elevation: Meters) => void;
    readonly onCancel: () => void;
  }) => {
    const [text, setText] = useState(String(mark.elevation));
    const inputRef = useRef<HTMLInputElement>(null);
    /**
     * Closing the field blurs it, and a blur commits — the flag keeps whatever
     * was typed when the user clicks away. This latch is what stops the blur
     * that follows Enter or Esc from committing a second time.
     */
    const isSettledRef = useRef(false);

    const commit = useFunction(() => {
      if (isSettledRef.current) {
        return;
      }

      isSettledRef.current = true;

      const elevation = parseElevation(text);

      if (isNil(elevation)) {
        onCancel();

        return;
      }

      onApply(elevation);
    });

    const cancel = useFunction(() => {
      isSettledRef.current = true;
      onCancel();
    });

    const handleChange = useFunction((event: ChangeEvent<HTMLInputElement>) => {
      setText(event.target.value);
    });

    // Focused from the effect rather than through `autoFocus`: the attribute
    // steals focus wherever a component happens to mount, while this field is
    // mounted by the very click that asked for it. Selecting the text makes the
    // starting value the first thing a keystroke replaces.
    useEffect(() => {
      inputRef.current?.select();
    }, []);

    const handleKeyDown = useFunction((event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === COMMIT_KEY) {
        event.preventDefault();
        commit();

        return;
      }

      if (event.key === CANCEL_KEY) {
        event.preventDefault();
        cancel();
      }
    });

    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        maxLength={INPUT_MAX_LENGTH}
        aria-label={sitePlannerT.marks.elevationInputLabel}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        style={{ left: `${screenPoint.x}px`, top: `${screenPoint.y - OFFSET_ABOVE_MARK_PX}px` }}
        className="absolute w-20 -translate-x-1/2 -translate-y-1/2 rounded-md border border-brand-500 bg-black/80 px-1.5 py-0.5 text-center font-mono text-[11px] text-text focus:outline-none"
      />
    );
  }
);

/**
 * The elevation field floating by a freshly placed mark. It is mounted per mark
 * — the key is what resets the typed text when a second mark is placed before
 * the first one is settled — and it is positioned from the store's mirror of the
 * viewport, so it follows the flag through a pan or a zoom.
 */
export const ElevationMarkInput = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const mark = store.siteObjects.elevationInputMark;

  const handleApply = useFunction((elevation: Meters) => {
    if (!isNil(mark)) {
      store.siteObjects.setElevationMarkElevation(mark.id, elevation);
    }

    store.siteObjects.closeElevationInput();
  });

  if (isNil(mark)) {
    return undefined;
  }

  return (
    <ElevationField
      key={mark.id}
      mark={mark}
      screenPoint={planToScreen(store.view.viewport, mark.position)}
      onApply={handleApply}
      onCancel={store.siteObjects.closeElevationInput}
    />
  );
});
