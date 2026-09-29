import type { IColumnMeasure, IMeasurePort } from '../../../extensions/column-resize/core';

const TITLE_CLASS = 'ft-header-title';

/** Padding and borders: what a `border-box` cell takes from its width before the content gets any. */
function horizontalInset(element: Element): number {
  const style = getComputedStyle(element);
  return (
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight) +
    Number.parseFloat(style.borderLeftWidth) +
    Number.parseFloat(style.borderRightWidth)
  );
}

/** The laid-out width of an element's contents, overflow included, so a clipped text still reports its full length. */
function contentWidth(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
}

/**
 * Title at its natural length, the parts (sort indicator, filter button…)
 * as laid out, the flex gaps and the padding. A gap sits between every
 * displayed child, an empty part included, exactly as the flex layout puts
 * it.
 */
function headerWidth(cell: HTMLElement): number {
  const gap = Number.parseFloat(getComputedStyle(cell).columnGap) || 0;
  const children = [...cell.children].filter(child => getComputedStyle(child).display !== 'none');
  const content = children.reduce(
    (sum, child) =>
      sum +
      (child.classList.contains(TITLE_CLASS)
        ? contentWidth(child)
        : child.getBoundingClientRect().width),
    0
  );
  return content + Math.max(0, children.length - 1) * gap + horizontalInset(cell);
}

function escape(columnId: string): string {
  return CSS.escape(columnId);
}

/** Measures the header and the rendered cells of a column inside one table root; a nested table's cells are not this table's. */
export function createMeasurePort(root: HTMLElement): IMeasurePort {
  const own = (element: Element): boolean => element.closest('.ft') === root;
  return {
    measureColumn(columnId): IColumnMeasure | undefined {
      const header = [
        ...root.querySelectorAll<HTMLElement>(
          `.ft-header-row .ft-header-cell[data-column-id="${escape(columnId)}"]`
        ),
      ].find(own);
      if (header === undefined) {
        return undefined;
      }
      const cells = [
        ...root.querySelectorAll<HTMLElement>(`.ft-cell[data-column-id="${escape(columnId)}"]`),
      ].filter(cell => own(cell) && !cell.hasAttribute('data-editing'));
      const padding = cells.length === 0 ? 0 : horizontalInset(cells[0]);
      const widest = cells.reduce((max, cell) => Math.max(max, contentWidth(cell)), 0);
      return {
        header: headerWidth(header),
        content: cells.length === 0 ? undefined : widest + padding,
      };
    },
  };
}
