import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IQuickFilter } from '../../core/rows/row-query';
import type { TFilterModel } from './model';
import type { TAnyFilterSpec } from './spec';

export interface IFilterChange {
  readonly columnId: string;
  readonly previous: TFilterModel | undefined;
  readonly next: TFilterModel | undefined;
}

export interface IFilteringOptions {
  /** Show the row of filter fields under the header from the start. */
  readonly filterRow?: boolean;
  readonly onFilterChange?: (change: IFilterChange) => void;
}

export interface IFilteringState {
  readonly filters: Readonly<Record<string, TFilterModel>>;
  readonly quick: IQuickFilter;
  readonly extra: Readonly<Record<string, unknown>>;
  readonly filterRow: boolean;
}

export interface IFilteringSlice {
  readonly filters: Readonly<Record<string, TFilterModel>>;
  readonly quick: IQuickFilter;
  /** The quick filter text is a regexp that does not parse; rows are then not filtered by it. */
  readonly quickInvalid: boolean;
  readonly extra: Readonly<Record<string, unknown>>;
  readonly filterRow: boolean;
  readonly activeCount: number;
  specOf(columnId: string): TAnyFilterSpec | undefined;
  modelOf(columnId: string): TFilterModel | undefined;
  reasonAgainst(columnId: string): string | undefined;
  /** Distinct values met in the rows so far, for `set` filters that accumulate; display order of first sight. */
  valuesSeen(columnId: string): readonly unknown[];
  /** An "equals this value" model for the column, to link into another table with a filter set. */
  filterFor(columnId: string, value: unknown): TFilterModel | undefined;
  set(columnId: string, model: TFilterModel | null): TCommandOutcome;
  clear(): TCommandOutcome;
  setQuick(quick: Partial<IQuickFilter>): TCommandOutcome;
  setExtra(name: string, value: unknown): TCommandOutcome;
  setFilterRow(visible: boolean): void;
}
