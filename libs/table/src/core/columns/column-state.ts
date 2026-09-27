import type { TPinSide } from './column';

export type TWidthAuthor = 'user' | 'auto';

/** What the user (or an autosize pass after data arrived) changed about a column. */
export interface IColumnState {
  readonly id: string;
  readonly width?: number;
  readonly widthBy?: TWidthAuthor;
  readonly flex?: number;
  readonly pin?: TPinSide | null;
  readonly hidden?: boolean;
}
