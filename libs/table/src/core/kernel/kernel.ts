import type { EventBus } from '@frozik/utils/events/event-bus';
import type { ColumnsModel } from '../columns/columns-model';
import type { FocusModel } from '../focus/focus-model';
import type { IRowChange } from '../rows/row-change';
import type { IRowSource } from '../rows/row-source';
import type { ITableState } from '../state/table-state';
import type { CommandBus } from './command-bus';
import type { ITableCommands, ITableEvents } from './contracts';
import type { IMenuContext, TMenuItem } from './menu';

/** What every extension sees of the table: the model and the buses, nothing about other extensions but their slices. */
export interface ITableKernel<TRow, TContext> {
  readonly columns: ColumnsModel<TRow>;
  readonly rows: IRowSource<TRow>;
  readonly focus: FocusModel<TRow>;
  readonly events: EventBus<ITableEvents>;
  readonly commands: CommandBus<ITableCommands>;
  readonly context: TContext;
  readonly ready: boolean;
  readonly id: string | undefined;
  readonly state: ITableState;
  applyState(state: Partial<ITableState>): void;
  resetState(): void;
  rowKey(row: TRow): string;
  /** Extra height under a row, summed over the extensions that claim some (detail rows). */
  rowExtent(rowKey: string): number;
  extension<TSlice>(id: string): TSlice | undefined;
  /** Menu items every extension offers for the target, in registration order. */
  menu(context: IMenuContext<TRow>): readonly TMenuItem[];
  /** Hands confirmed edits to the application; the kernel never mutates rows itself. */
  changeRows(changes: readonly IRowChange<TRow>[]): void | Promise<void>;
  reportSourceError(error: unknown): void;
}
