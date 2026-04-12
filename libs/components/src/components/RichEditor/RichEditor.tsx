import { isEmpty, isNil } from 'lodash-es';
import type { KeyboardEvent } from 'react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { IOptions } from 'sanitize-html';
import sanitizeHtml from 'sanitize-html';

import { useFunction } from '../../hooks';
import type { ISelection } from './defs';
import {
  findNextTabStop,
  getElementSelection,
  inputElementSelectionWithValue,
  inputTextToHtml,
  isParentOf,
  setElementSelection,
} from './utils';

const SANITIZE_CONFIG: IOptions = {
  allowedTags: [],
  allowedAttributes: false,
};

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
  }) => {
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const selectionRangeRef = useRef<ISelection>(
      useMemo(() => ({ start: value.length, end: value.length }), [value])
    );
    const valueBeforeEditRef = useRef(value);

    const [focused, setFocused] = useState(false);

    const html = useMemo(() => onTextToHtml(value, focused), [onTextToHtml, value, focused]);

    const handleContentChange = useFunction(evt => {
      const oldValue = value;
      const newValue = sanitizeHtml(evt.currentTarget.innerHTML, SANITIZE_CONFIG);

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
        onValueChanged?.(result.value);
      }
    });

    useLayoutEffect(() => {
      if (isNil(contentEditableRef.current)) {
        return;
      }

      setElementSelection(contentEditableRef.current, selectionRangeRef.current);
    });

    useEffect(() => {
      if (isNil(contentEditableRef.current)) {
        return;
      }

      setFocused(isParentOf(document.activeElement, contentEditableRef.current));
    }, []);

    const handleFocused = useFunction(() => {
      valueBeforeEditRef.current = value;
      setFocused(true);
      onFocusChanges?.(true);

      if (onFocusSelection) {
        const selection = onFocusSelection(value);
        if (!isNil(selection)) {
          // Deferred to next frame so the browser's focus-related selectionchange events
          // settle first, then we override with the desired selection
          requestAnimationFrame(() => {
            if (!isNil(contentEditableRef.current)) {
              selectionRangeRef.current = selection;
              setElementSelection(contentEditableRef.current, selection);
            }
          });
        }
      }
    });
    const handleBlur = useFunction(() => {
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

      selectionRangeRef.current =
        getElementSelection(contentEditableRef.current) ?? selectionRangeRef.current;
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
      <div
        ref={contentEditableRef}
        className={className}
        style={{
          textOverflow: 'clip',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          display: 'inline-block',
        }}
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
