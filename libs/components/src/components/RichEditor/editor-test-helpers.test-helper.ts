import { act } from '@testing-library/react';

import type { ISelection } from './defs';
import { setElementSelection } from './selection';

export function editorOf(container: HTMLElement): HTMLElement {
  const editor = container.querySelector<HTMLElement>('[role="textbox"]');
  if (editor === null) {
    throw new Error('no editor rendered');
  }
  return editor;
}

/** Drives the editor the way a browser does: focus, place the caret, fire `beforeinput`. */
export function typeInto(
  editor: HTMLElement,
  {
    inputType = 'insertText',
    data,
    selection,
  }: { readonly inputType?: string; readonly data?: string; readonly selection?: ISelection }
): void {
  act(() => {
    editor.focus();
    if (selection !== undefined) {
      setElementSelection(editor, selection);
    }
    const event = new InputEvent('beforeinput', {
      inputType,
      data,
      cancelable: true,
      bubbles: true,
    });
    Object.assign(event, { getTargetRanges: () => [] });
    editor.dispatchEvent(event);
  });
}

export function focusEditor(editor: HTMLElement): void {
  act(() => {
    editor.focus();
  });
}

export function blurEditor(editor: HTMLElement): void {
  act(() => {
    editor.blur();
  });
}
