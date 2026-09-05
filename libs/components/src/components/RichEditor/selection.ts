import { isNil } from 'lodash-es';

import type { ISelection } from './defs';

interface ITextPosition {
  readonly node: Node;
  readonly offset: number;
}

function textNodesOf(element: HTMLElement): readonly Text[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  for (let node = walker.nextNode(); !isNil(node); node = walker.nextNode()) {
    if (node instanceof Text) {
      nodes.push(node);
    }
  }

  return nodes;
}

/** Characters between the start of `element` and a boundary point inside it. */
function textOffsetOf(element: HTMLElement, container: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(element, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

function textPositionAt(element: HTMLElement, offset: number): ITextPosition {
  let consumed = 0;
  let lastNode: Text | undefined;

  for (const node of textNodesOf(element)) {
    const length = node.data.length;
    if (offset <= consumed + length) {
      return { node, offset: offset - consumed };
    }
    consumed += length;
    lastNode = node;
  }

  return isNil(lastNode)
    ? { node: element, offset: 0 }
    : { node: lastNode, offset: lastNode.data.length };
}

function isFocusedWithin(element: HTMLElement): boolean {
  return element.contains(document.activeElement);
}

/** Maps a DOM range (live or static) inside `element` to character offsets. */
export function rangeToSelection(
  element: HTMLElement,
  range: AbstractRange
): ISelection | undefined {
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
    return undefined;
  }

  return {
    start: textOffsetOf(element, range.startContainer, range.startOffset),
    end: textOffsetOf(element, range.endContainer, range.endOffset),
  };
}

/** The document selection as character offsets in `element`; `start > end` for a backward selection. */
export function getElementSelection(element: HTMLElement): ISelection | undefined {
  if (!isFocusedWithin(element)) {
    return undefined;
  }

  const selection = document.getSelection();
  if (
    isNil(selection) ||
    isNil(selection.anchorNode) ||
    isNil(selection.focusNode) ||
    !element.contains(selection.anchorNode) ||
    !element.contains(selection.focusNode)
  ) {
    return undefined;
  }

  return {
    start: textOffsetOf(element, selection.anchorNode, selection.anchorOffset),
    end: textOffsetOf(element, selection.focusNode, selection.focusOffset),
  };
}

export function setElementSelection(element: HTMLElement, target: ISelection): void {
  if (!isFocusedWithin(element)) {
    return;
  }

  const selection = document.getSelection();
  if (isNil(selection)) {
    return;
  }

  const anchor = textPositionAt(element, target.start);
  const focus = textPositionAt(element, target.end);
  selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
}
