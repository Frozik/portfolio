import { isEmpty, isNil } from 'lodash-es';

import type { ISelection } from './defs';
import styles from './styles.module.scss';

export function inputElementSelectionWithValue({
  newValue,
  newSelection,
}: {
  oldValue: string;
  newValue: string;
  oldSelection: ISelection;
  newSelection: ISelection;
}): {
  value: string;
  selection: ISelection;
} {
  return {
    value: newValue,
    selection: newSelection,
  };
}

export function inputTextToHtml(text: string): string {
  return text;
}

export function numericElementSelectionWithValueBuilder({
  allowNegative = false,
}: {
  allowNegative?: boolean;
}): (props: {
  oldValue: string;
  newValue: string;
  oldSelection: ISelection;
  newSelection: ISelection;
}) => { value: string; selection: ISelection } | false {
  return function rateElementSelectionWithValue({
    newValue: rawNewValue,
    newSelection: rawNewSelection,
  }): { value: string; selection: ISelection } | false {
    const fastInputSuffixes = rawNewValue.replace(/[^kmb]/gi, '');

    if (fastInputSuffixes.length > 1) {
      return false;
    }

    const fastInputZeros = fastInputSuffixes.length > 0 ? extractSuffix(fastInputSuffixes) : '';

    const newValue =
      fastInputSuffixes.length > 0
        ? rawNewValue.replace(fastInputSuffixes, fastInputZeros)
        : rawNewValue;

    const newSelection =
      fastInputSuffixes.length > 0
        ? {
            start: Math.min(newValue.length, rawNewSelection.start + fastInputZeros.length),
            end: Math.min(newValue.length, rawNewSelection.end + fastInputZeros.length),
          }
        : rawNewSelection;

    const testRegEx = allowNegative ? /^-?[0-9.]*$/ : /^[0-9.]*$/;

    if (!testRegEx.test(newValue) || newValue.indexOf('.') !== newValue.lastIndexOf('.')) {
      return false;
    }

    const onlyDigits = newValue.replace(/[.-]/g, '');

    if (onlyDigits.length > 50 || onlyDigits.replace(/^0+|0+$/g, '').length > 15) {
      return false;
    }

    return { value: newValue, selection: newSelection };
  };
}

function extractSuffix(suffix: string): string {
  switch (suffix.toLowerCase()) {
    case 'k':
      return '000';
    case 'm':
      return '000000';
    case 'b':
      return '000000000';
    default:
      return '';
  }
}

export function numericTextToHtmlBuilder({
  decimal,
  pipStart,
  pipSize = 2,
}: {
  decimal?: number;
  pipStart?: number;
  pipSize?: number;
}): (text: string, editing: boolean) => string {
  return function rateTextToHtml(text: string, editing: boolean): string {
    if (isEmpty(text)) {
      return '';
    }

    const hasSign = text.startsWith('-');
    const absText = hasSign ? text.substring(1) : text;

    const dividerIndex = absText.indexOf('.');
    const startPositionCount = (dividerIndex < 0 ? absText.length : dividerIndex) - 1;
    let lastPosition = 0;
    let processedDivider = false;
    const lettersMap = absText.split('').reduce(
      (acc, letter, index) => {
        const position = startPositionCount - index + (processedDivider ? 1 : 0);

        if (letter === '.') {
          acc.push({ position: Number.NaN, letter });
          processedDivider = true;
        } else {
          acc.push({ position: letter === '.' ? Number.NaN : position, letter });
          lastPosition = position;
        }

        return acc;
      },
      [] as { position: number; letter: string }[]
    );

    const totalPosition = editing
      ? 0
      : -Math.max(decimal ?? 0, isNil(pipStart) ? 0 : pipStart + pipSize);

    if (!processedDivider && (dividerIndex >= 0 || totalPosition < 0)) {
      lettersMap.push({ position: Number.NaN, letter: '.' });
    }

    for (let position = lastPosition - 1; position >= totalPosition; position--) {
      lettersMap.push({ position, letter: '0' });
    }

    if (hasSign) {
      lettersMap.unshift({ position: Number.NaN, letter: '-' });
    }

    function getEndGroupClassName(position: number): string {
      return Number.isNaN(position) || position < 0 || position % 3 !== 0 || position === 0
        ? ''
        : styles.groupEnd;
    }

    function getStartGroupClassName(position: number): string {
      return Number.isNaN(position) ||
        position < 0 ||
        position % 3 !== 2 ||
        position === startPositionCount
        ? ''
        : styles.groupStart;
    }

    function getPipClassName(position: number): string {
      return isNil(pipStart) ||
        Number.isNaN(position) ||
        position > -pipStart ||
        position < -(pipStart + pipSize - 1)
        ? ''
        : styles.pip;
    }

    return lettersMap
      .map(({ letter, position }) => {
        const classNames = [
          getEndGroupClassName(position),
          getStartGroupClassName(position),
          getPipClassName(position),
        ]
          .filter(className => !isEmpty(className))
          .join(' ');
        return isEmpty(classNames) ? letter : `<span class="${classNames}">${letter}</span>`;
      })
      .join('');
  };
}

export function isParentOf(el: Element | null, parent: Element): boolean {
  if (isNil(el)) {
    return false;
  }

  if (el === parent) {
    return true;
  }

  return isParentOf(el.parentElement, parent);
}

export function* traverseTextNodes(node: Node): Generator<Node> {
  if (node.nodeType === Node.TEXT_NODE) {
    yield node;
  }

  for (const child of node.childNodes) {
    yield* traverseTextNodes(child);
  }
}

export function getElementSelection(element: HTMLElement): ISelection | null {
  if (!isParentOf(document.activeElement, element)) {
    return null;
  }

  const selection = document.getSelection();

  if (isNil(selection)) {
    return null;
  }

  const range: { start: number; end: number } = { start: 0, end: 0 };

  let currentOffset = 0;

  for (const textNode of traverseTextNodes(element)) {
    if (textNode === selection.anchorNode) {
      range.start = currentOffset + selection.anchorOffset;
    }

    if (textNode === selection.focusNode) {
      range.end = currentOffset + selection.focusOffset;
    }

    currentOffset += textNode.textContent?.length ?? 0;
  }

  return range;
}

export function setElementSelection(element: HTMLElement, selectionRange: ISelection): void {
  if (!isParentOf(document.activeElement, element)) {
    return;
  }

  let currentOffset = 0;

  let startRange: { node: Node; offset: number } | undefined;
  let endRange: { node: Node; offset: number } | undefined;

  for (const textNode of traverseTextNodes(element)) {
    const length = textNode.textContent?.length ?? 0;

    if (length === 0) {
      continue;
    }

    if (selectionRange.start >= currentOffset && selectionRange.start <= currentOffset + length) {
      startRange = { node: textNode, offset: selectionRange.start - currentOffset };
    }
    if (selectionRange.end >= currentOffset && selectionRange.end <= currentOffset + length) {
      endRange = { node: textNode, offset: selectionRange.end - currentOffset };
    }

    if (!isNil(startRange) && !isNil(endRange)) {
      break;
    }

    currentOffset += textNode.textContent?.length ?? 0;
  }

  const selection = document.getSelection();

  if (isNil(startRange) || isNil(endRange) || isNil(selection)) {
    return;
  }

  selection.removeAllRanges();
  const range = document.createRange();

  if (selectionRange.start === selectionRange.end) {
    range.setStart(startRange.node, startRange.offset);
    range.collapse(true);

    selection.addRange(range);
  } else if (selectionRange.start < selectionRange.end) {
    range.setStart(startRange.node, startRange.offset);
    range.setEnd(endRange.node, endRange.offset);

    selection.addRange(range);
  } else {
    range.setStart(startRange.node, startRange.offset);

    selection.addRange(range);
    selection.extend(endRange.node, endRange.offset);
  }
}

export function findNextTabStop(anchorElement: HTMLElement): HTMLElement | null {
  const selector = `div[contenteditable]:not([disabled]), a[href]:not([disabled]), button:not([disabled]),
        select:not([disabled]), textarea:not([disabled]), input:not([type=hidden]):not([disabled]),
        [tabindex]:not([disabled]):not([tabindex="-1"])`;

  const list = Array.from(document.querySelectorAll(selector));
  const index = list.indexOf(anchorElement);
  const nextElement = (list[index + 1] ?? list[0]) as HTMLElement;

  return nextElement === anchorElement || isNil(nextElement.focus)
    ? null
    : (nextElement as HTMLElement);
}
