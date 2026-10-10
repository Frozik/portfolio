import { isEmpty, isNil } from 'lodash-es';

import type { ITextSegment, TSegmentRenderer } from './defs';

export const plainSegments: TSegmentRenderer = text => (isEmpty(text) ? [] : [{ text }]);

/** Joins neighbours with the same class, so a run of plain characters becomes one text node. */
export function mergeSegments(segments: readonly ITextSegment[]): readonly ITextSegment[] {
  return segments.reduce<ITextSegment[]>((merged, segment) => {
    const previous = merged.at(-1);
    if (!isNil(previous) && previous.className === segment.className) {
      merged[merged.length - 1] = { ...previous, text: previous.text + segment.text };
    } else {
      merged.push(segment);
    }
    return merged;
  }, []);
}

export function renderSegments(element: HTMLElement, segments: readonly ITextSegment[]): void {
  element.replaceChildren(
    ...segments.map(({ text, className }) => {
      if (isNil(className)) {
        return document.createTextNode(text);
      }
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      return span;
    })
  );
}
