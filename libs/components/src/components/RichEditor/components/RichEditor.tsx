import { isEqual, isNil } from 'lodash-es';
import type { CompositionEvent, KeyboardEvent, PointerEvent, Ref } from 'react';
import {
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useFunction } from '../../../hooks/useFunction';
import { cn } from '../../cn';
import type {
  INormalizedInput,
  IRichEditorHandle,
  ISelection,
  THtmlRenderer,
  TInputNormalizer,
} from '../defs';
import { findNextTabStop } from '../focus-navigation';
import { getElementSelection, rangeToSelection, setElementSelection } from '../selection';
import styles from '../styles.module.scss';
import { applyTextEdit, readInputData, textEditFromInput, toSingleLine } from '../text-edit';

const acceptInput: TInputNormalizer = (value, selection) => ({ value, selection });
const plainHtml: THtmlRenderer = text => text;

const PLAINTEXT_ONLY = 'plaintext-only';
// Engines without `plaintext-only` treat the unknown value as `inherit`, which
// would make the field read-only; `beforeinput` interception keeps the field
// plain text either way.
const PLAINTEXT_ONLY_SUPPORTED = (() => {
  const probe = document.createElement('div');
  probe.contentEditable = PLAINTEXT_ONLY;
  return probe.contentEditable === PLAINTEXT_ONLY;
})();

function endOf(value: string): ISelection {
  return { start: value.length, end: value.length };
}

/**
 * Single-line, strictly controlled contentEditable. Every edit is intercepted
 * in `beforeinput`, applied to `value` as a string operation and passed
 * through `normalizeInput`; the DOM only ever shows what `toHtml` renders for
 * the current `value`. IME composition is the one edit the browser must own:
 * the field reads the composed text back on `compositionend`.
 */
export const RichEditor = memo(
  ({
    ref,
    className,
    disabled = false,
    value = '',
    placeholder,
    inputMode,
    enterKeyHint = 'next',
    onValueChange,
    normalizeInput = acceptInput,
    toHtml = plainHtml,
    onFocusChange,
    onFocusSelection,
    onCancel,
    onKeyDown,
    'aria-label': ariaLabel,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
  }: {
    readonly ref?: Ref<IRichEditorHandle>;
    readonly className?: string;
    readonly disabled?: boolean;
    readonly value?: string;
    readonly placeholder?: string;
    readonly inputMode?: 'text' | 'decimal' | 'numeric';
    readonly enterKeyHint?: 'enter' | 'done' | 'next';
    readonly onValueChange?: (value: string) => void;
    readonly normalizeInput?: TInputNormalizer;
    readonly toHtml?: THtmlRenderer;
    readonly onFocusChange?: (focused: boolean) => void;
    /** Selection to apply when the field gains focus; `undefined` keeps the caret where the browser put it. */
    readonly onFocusSelection?: (value: string) => ISelection | undefined;
    /** Escape: the owner reverts its own state before the field blurs. */
    readonly onCancel?: () => void;
    readonly onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
    readonly 'aria-label'?: string;
    readonly 'aria-invalid'?: boolean;
    readonly 'aria-describedby'?: string;
  }) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const selectionRef = useRef<ISelection>(endOf(value));
    const emittedValueRef = useRef(value);
    const composingRef = useRef(false);
    const [focused, setFocused] = useState(false);

    const moveFocusOnward = useFunction(() => {
      const element = elementRef.current;
      if (isNil(element)) {
        return;
      }
      const next = findNextTabStop(element);
      if (isNil(next)) {
        element.blur();
      } else {
        next.focus();
      }
    });

    useImperativeHandle(
      ref,
      () => ({ focus: () => elementRef.current?.focus(), focusNext: moveFocusOnward }),
      [moveFocusOnward]
    );

    const html = useMemo(() => toHtml(value, focused), [toHtml, value, focused]);

    const restoreDom = useFunction(() => {
      const element = elementRef.current;
      if (isNil(element)) {
        return;
      }
      element.innerHTML = html;
      setElementSelection(element, selectionRef.current);
    });

    const commit = useFunction((result: INormalizedInput | undefined) => {
      if (isNil(result)) {
        restoreDom();
        return;
      }

      selectionRef.current = result.selection;
      if (result.value === value) {
        restoreDom();
        return;
      }
      emittedValueRef.current = result.value;
      onValueChange?.(result.value);
    });

    const handleBeforeInput = useFunction((event: InputEvent) => {
      const element = elementRef.current;
      if (isNil(element) || event.isComposing || event.inputType === 'insertCompositionText') {
        return;
      }

      event.preventDefault();

      const [targetRange] = event.getTargetRanges();
      const edit = textEditFromInput({
        inputType: event.inputType,
        data: readInputData(event),
        targetRange:
          (isNil(targetRange) ? undefined : rangeToSelection(element, targetRange)) ??
          getElementSelection(element) ??
          selectionRef.current,
      });
      if (isNil(edit)) {
        return;
      }

      const next = applyTextEdit(value, edit);
      commit(normalizeInput(next.value, next.selection));
    });

    const handleSelectionChange = useFunction(() => {
      const element = elementRef.current;
      if (isNil(element) || composingRef.current) {
        return;
      }
      selectionRef.current = getElementSelection(element) ?? selectionRef.current;
    });

    // React's `onBeforeInput` is a synthetic approximation without `inputType`
    // or target ranges; the native event is the one carrying the edit.
    useEffect(() => {
      const element = elementRef.current;
      if (isNil(element)) {
        return;
      }

      const controller = new AbortController();
      const { signal } = controller;
      element.addEventListener('beforeinput', handleBeforeInput, { signal });
      document.addEventListener('selectionchange', handleSelectionChange, { signal });

      return () => controller.abort();
    }, [handleBeforeInput, handleSelectionChange]);

    useLayoutEffect(() => {
      if (value !== emittedValueRef.current) {
        emittedValueRef.current = value;
        selectionRef.current = endOf(value);
      }
    }, [value]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: React rewrites the DOM whenever `html` changes, and the selection has to be re-applied after every rewrite
    useLayoutEffect(() => {
      const element = elementRef.current;
      if (isNil(element) || !focused || composingRef.current) {
        return;
      }
      if (!isEqual(getElementSelection(element), selectionRef.current)) {
        setElementSelection(element, selectionRef.current);
      }
    }, [html, focused]);

    const handleCompositionStart = useFunction(() => {
      composingRef.current = true;
    });

    const handleCompositionEnd = useFunction((event: CompositionEvent<HTMLDivElement>) => {
      composingRef.current = false;

      const element = event.currentTarget;
      const composed = toSingleLine(element.textContent ?? '');
      const selection = getElementSelection(element) ?? endOf(composed);
      commit(normalizeInput(composed, selection));
    });

    const handlePointerDown = useFunction((event: PointerEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      if (disabled || element.contains(document.activeElement)) {
        return;
      }
      if (isNil(onFocusSelection?.(value))) {
        return;
      }

      // Focusing here, with the default prevented, means the browser never
      // places its own caret and the focus selection is the first one shown.
      event.preventDefault();
      element.focus();
    });

    const handleFocus = useFunction(() => {
      if (disabled) {
        return;
      }
      selectionRef.current = onFocusSelection?.(value) ?? selectionRef.current;
      setFocused(true);
      onFocusChange?.(true);
    });

    const handleBlur = useFunction(() => {
      composingRef.current = false;
      setFocused(false);
      onFocusChange?.(false);
    });

    const handleKeyDown = useFunction((event: KeyboardEvent<HTMLDivElement>) => {
      if (event.nativeEvent.isComposing) {
        return;
      }

      // Overlay layers (Radix) prevent Escape in the capture phase before the
      // event reaches the field; only the owner's own veto skips the built-ins.
      const preventedBefore = event.defaultPrevented;
      onKeyDown?.(event);
      if (event.defaultPrevented && !preventedBefore) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
        event.currentTarget.blur();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        moveFocusOnward();
      }
    });

    return (
      // biome-ignore lint/a11y/useSemanticElements: the field renders formatted HTML, which no <input> can show
      <div
        ref={elementRef}
        className={cn(styles.contentEditable, className)}
        role="textbox"
        tabIndex={disabled ? undefined : 0}
        aria-multiline={false}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        contentEditable={disabled ? false : PLAINTEXT_ONLY_SUPPORTED ? PLAINTEXT_ONLY : true}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML is rendered from `value` by `toHtml`, never from user markup
        dangerouslySetInnerHTML={{ __html: html }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />
    );
  }
);
