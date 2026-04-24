import { isEmpty, isNil } from 'lodash-es';
import type { FormEvent, KeyboardEvent } from 'react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useFunction } from '../../../hooks/useFunction';
import type { ISelection } from '../defs';
import styles from '../styles.module.scss';
import {
  findNextTabStop,
  getElementSelection,
  inputElementSelectionWithValue,
  inputTextToHtml,
  isParentOf,
  setElementSelection,
} from '../utils';

/**
 * Strip every tag from a contenteditable HTML fragment, returning the
 * plain text the user has typed / pasted. Replaces the previous
 * `sanitize-html` call with a native DOMParser — sanitize-html ships
 * `postcss` for style sanitisation, which in the browser pulls in
 * `path` / `fs` / `url` / `source-map-js` Node built-ins and fills
 * the dev console with "has been externalized for browser
 * compatibility" warnings on every page load.
 *
 * DOMParser runs in an inert document: script / event-handler side
 * effects do not fire at parse time. We still explicitly remove
 * `<script>`, `<style>`, `<noscript>` and `<iframe>` before reading
 * `textContent` so their character payloads don't leak into the
 * output — matching `sanitize-html({ allowedTags: [] })`.
 */
function stripAllTags(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const element of doc.querySelectorAll('script, style, noscript, iframe')) {
    element.remove();
  }
  return doc.body.textContent ?? '';
}

export const RichEditor = memo(
  ({
    className,
    disabled = false,
    value = '',
    placeholder,
    onValueChanged,
    onGetElementSelectionWithValue = inputElementSelectionWithValue,
    onTextToHtml = inputTextToHtml,
    onFocusChanges,
    onFocusSelection,
    onKeyDown,
    'aria-label': ariaLabel,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
  }: {
    className?: string;
    disabled?: boolean;
    value?: string;
    placeholder?: string;
    onValueChanged?: (value: string) => void;
    onGetElementSelectionWithValue?: (props: {
      oldValue: string;
      newValue: string;
      oldSelection: ISelection;
      newSelection: ISelection;
    }) => { value: string; selection: ISelection } | false;
    onTextToHtml?: (text: string, editing: boolean) => string;
    onFocusChanges?: (focused: boolean) => void;
    onFocusSelection?: (value: string) => ISelection | undefined;
    onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
    'aria-label'?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }) => {
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const selectionRangeRef = useRef<ISelection>(
      useMemo(() => ({ start: value.length, end: value.length }), [value])
    );
    const valueBeforeEditRef = useRef(value);
    const previousValueRef = useRef(value);
    const valueFromInputRef = useRef(false);
    // Focus selection applied after pointer/keyboard focus settles (ProseMirror pattern)
    const pendingFocusSelectionRef = useRef<ISelection | null>(null);
    const focusCleanupRef = useRef<(() => void) | null>(null);

    const [focused, setFocused] = useState(false);

    const html = useMemo(() => onTextToHtml(value, focused), [onTextToHtml, value, focused]);

    const handleContentChange = useFunction((evt: FormEvent<HTMLDivElement>) => {
      pendingFocusSelectionRef.current = null;

      const oldValue = value;
      const newValue = stripAllTags(evt.currentTarget.innerHTML);

      const oldSelection = selectionRangeRef.current;
      const newSelection = getElementSelection(evt.currentTarget) ?? {
        start: value.length,
        end: value.length,
      };

      const result = onGetElementSelectionWithValue({
        oldValue,
        newValue,
        oldSelection,
        newSelection,
      });

      if (result === false) {
        evt.currentTarget.innerHTML = html;
        setElementSelection(evt.currentTarget, oldSelection);
      } else {
        selectionRangeRef.current = result.selection;
        valueFromInputRef.current = true;
        onValueChanged?.(result.value);
      }
    });

    useLayoutEffect(() => {
      if (isNil(contentEditableRef.current)) {
        return;
      }

      if (focused && value !== previousValueRef.current && !valueFromInputRef.current) {
        selectionRangeRef.current = { start: value.length, end: value.length };
      }
      previousValueRef.current = value;
      valueFromInputRef.current = false;
      setElementSelection(contentEditableRef.current, selectionRangeRef.current);
    });

    useEffect(() => {
      if (isNil(contentEditableRef.current)) {
        return;
      }

      setFocused(isParentOf(document.activeElement, contentEditableRef.current));
    }, []);

    // Applies the pending focus selection and clears it.
    // Called via setTimeout(0) to run after all synchronous event handlers
    // (mouseup, click, selectionchange) in the current event have completed.
    const applyPendingFocusSelection = useFunction(() => {
      const selection = pendingFocusSelectionRef.current;
      pendingFocusSelectionRef.current = null;
      if (!isNil(selection) && !isNil(contentEditableRef.current)) {
        selectionRangeRef.current = selection;
        setElementSelection(contentEditableRef.current, selection);
        // Restore selection visibility now that the correct selection is set
        contentEditableRef.current.classList.remove(styles.selectionHidden);
      }
    });

    const handleFocused = useFunction(() => {
      valueBeforeEditRef.current = value;
      setFocused(true);
      onFocusChanges?.(true);

      if (onFocusSelection) {
        const selection = onFocusSelection(value);
        if (!isNil(selection)) {
          selectionRangeRef.current = selection;
          pendingFocusSelectionRef.current = selection;

          // Hide browser's default selection highlight during focus transition
          contentEditableRef.current?.classList.add(styles.selectionHidden);

          // ProseMirror pattern: wait for pointerup (mouse focus) or use a
          // fallback timeout (keyboard focus). pointerup fires after mouseup,
          // guaranteeing all browser selection events have completed.
          const apply = () => {
            focusCleanupRef.current = null;
            // RAF runs before the next paint, so the user never sees the browser's
            // intermediate selection. Safe here because we schedule from pointerup
            // or fallback setTimeout — both are separate macrotasks, so this RAF
            // is guaranteed to land in the next frame (not the current one).
            requestAnimationFrame(applyPendingFocusSelection);
          };

          const onPointerUp = () => {
            clearTimeout(fallbackTimer);
            apply();
          };

          document.addEventListener('pointerup', onPointerUp, { once: true });

          // Fallback: keyboard focus (Tab) has no pointerup.
          // 50ms is enough for any click to complete but fast enough for keyboard UX.
          const KEYBOARD_FOCUS_FALLBACK_MS = 50;
          const fallbackTimer = setTimeout(() => {
            document.removeEventListener('pointerup', onPointerUp);
            apply();
          }, KEYBOARD_FOCUS_FALLBACK_MS);

          focusCleanupRef.current = () => {
            document.removeEventListener('pointerup', onPointerUp);
            clearTimeout(fallbackTimer);
          };
        }
      }
    });

    const handleBlur = useFunction(() => {
      pendingFocusSelectionRef.current = null;
      focusCleanupRef.current?.();
      focusCleanupRef.current = null;
      contentEditableRef.current?.classList.remove(styles.selectionHidden);
      setFocused(false);
      onFocusChanges?.(false);
    });

    const handleKeyDown = useFunction((event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);

      if (event.defaultPrevented) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onValueChanged?.(valueBeforeEditRef.current);
        event.currentTarget.blur();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const element = findNextTabStop(event.currentTarget);
        if (isNil(element)) {
          event.currentTarget.blur();
        } else {
          element.focus();
        }
      }
    });

    const handleSelectionChange = useFunction(() => {
      if (isNil(contentEditableRef.current)) {
        return;
      }

      // While focus selection is pending, ignore all browser-initiated selectionchange events.
      // The selection will be applied after the pointer/keyboard event sequence completes.
      if (!isNil(pendingFocusSelectionRef.current)) {
        return;
      }

      const sel = getElementSelection(contentEditableRef.current);
      selectionRangeRef.current = sel ?? selectionRangeRef.current;
    });

    useEffect(() => {
      if (isNil(contentEditableRef.current) || !focused) {
        return;
      }

      document.addEventListener('selectionchange', handleSelectionChange);

      return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [handleSelectionChange, focused]);

    const updateFocused = useFunction((newFocused: boolean) => {
      if (newFocused === focused) {
        return;
      }

      setFocused(newFocused);
      onFocusChanges?.(newFocused);
    });

    useEffect(() => {
      if (isNil(contentEditableRef.current)) {
        return;
      }

      updateFocused(isParentOf(document.activeElement, contentEditableRef.current));
    }, [updateFocused]);

    return (
      // biome-ignore lint/a11y/useSemanticElements: contentEditable div requires dangerouslySetInnerHTML for rich text, cannot use <input> or <textarea>
      <div
        ref={contentEditableRef}
        className={className}
        style={{
          textOverflow: 'clip',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          display: 'inline-block',
        }}
        role="textbox"
        tabIndex={disabled ? -1 : 0}
        aria-multiline={false}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        contentEditable={!disabled}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: RichEditor requires innerHTML for contentEditable
        dangerouslySetInnerHTML={{
          __html: focused || !isEmpty(value) || isNil(placeholder) ? html : placeholder,
        }}
        onInput={handleContentChange}
        onFocus={handleFocused}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  }
);
