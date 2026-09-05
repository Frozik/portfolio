import { isNil } from 'lodash-es';

import type { INormalizedInput, ISelection } from './defs';

export interface ITextEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const LINE_BREAK_INPUT_TYPES = new Set(['insertLineBreak', 'insertParagraph']);

/** A single-line field: line breaks become spaces, non-breaking spaces become spaces. */
export function toSingleLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').replace(/\u00a0/g, ' ');
}

function orderedRange({ start, end }: ISelection): ISelection {
  return start <= end ? { start, end } : { start: end, end: start };
}

/**
 * Translates a `beforeinput` event into the edit it asks for, or `undefined`
 * for input the field does not support (line breaks, formatting, history).
 */
export function textEditFromInput({
  inputType,
  data,
  targetRange,
}: {
  readonly inputType: string;
  readonly data: string | undefined;
  readonly targetRange: ISelection;
}): ITextEdit | undefined {
  const { start, end } = orderedRange(targetRange);

  if (inputType.startsWith('insert') && !LINE_BREAK_INPUT_TYPES.has(inputType)) {
    return { start, end, text: toSingleLine(data ?? '') };
  }

  if (inputType.startsWith('delete')) {
    if (start !== end) {
      return { start, end, text: '' };
    }
    return inputType === 'deleteContentForward'
      ? { start, end: start + 1, text: '' }
      : { start: Math.max(0, start - 1), end: start, text: '' };
  }

  return undefined;
}

export function applyTextEdit(value: string, { start, end, text }: ITextEdit): INormalizedInput {
  const caret = start + text.length;

  return {
    value: `${value.slice(0, start)}${text}${value.slice(end)}`,
    selection: { start: caret, end: caret },
  };
}

export function readInputData(event: InputEvent): string | undefined {
  if (!isNil(event.data)) {
    return event.data;
  }

  const transferred = event.dataTransfer?.getData('text/plain');
  return isNil(transferred) || transferred.length === 0 ? undefined : transferred;
}
