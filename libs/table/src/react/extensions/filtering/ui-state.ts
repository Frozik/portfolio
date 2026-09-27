import { makeAutoObservable } from 'mobx';

export interface IPopoverAnchor {
  readonly columnId: string;
  /** Relative to the table root. */
  readonly left: number;
  readonly top: number;
}

/** Which column's filter editor is open and where; view-only, never persisted. */
export class FilterUiState {
  anchor: IPopoverAnchor | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  toggle(anchor: IPopoverAnchor): void {
    this.anchor = this.anchor?.columnId === anchor.columnId ? null : anchor;
  }

  close(): void {
    this.anchor = null;
  }
}

export const ANCHOR_ATTRIBUTE = 'data-filter-anchor';

/** The popover anchor of an element inside a header cell or a filter field. */
export function anchorOf(element: HTMLElement, columnId: string): IPopoverAnchor {
  const cell = element.closest('.ft-header-cell, .ft-filter-cell') ?? element;
  const root = element.closest('.ft');
  const rect = cell.getBoundingClientRect();
  const rootRect = root?.getBoundingClientRect();
  return {
    columnId,
    left: rect.left - (rootRect?.left ?? 0),
    top: rect.bottom - (rootRect?.top ?? 0),
  };
}
