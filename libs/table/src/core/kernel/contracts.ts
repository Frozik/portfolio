import type { TPinSide } from '../columns/column';

/** Command ids and payloads. Extensions add their own through declaration merging. */
export interface ITableCommands {
  readonly 'columns.move': { readonly columnId: string; readonly toIndex: number };
  readonly 'columns.pin': { readonly columnId: string; readonly side: TPinSide | null };
  readonly 'columns.setVisible': { readonly columnId: string; readonly visible: boolean };
  readonly 'columns.resize': { readonly columnId: string; readonly width: number };
  readonly 'columns.reset': Record<string, never>;
  readonly 'state.apply': Record<string, never>;
  readonly 'state.reset': Record<string, never>;
}

/** Event names and payloads published after a change. Extensions add their own through declaration merging. */
export interface ITableEvents {
  readonly 'columns.changed': { readonly columnId: string | undefined };
  readonly 'state.changed': undefined;
  readonly 'rows.changed': undefined;
}

export type TCommandId = keyof ITableCommands;
