import type { TColumnKind } from '../../../core/columns/column';
import type { ICellContext, IColumn } from '../../column';
import { resolve } from '../../column';
import type { IEditorSpec, TEditorComponent, TEditorKind } from './editing-column';
import { DateEditor } from './editors/DateEditor';
import { NumberEditor } from './editors/NumberEditor';
import { SelectEditor } from './editors/SelectEditor';
import { TextareaEditor } from './editors/TextareaEditor';
import { TextEditor } from './editors/TextEditor';

export interface IResolvedEditor<TRow> {
  readonly kind: TEditorKind;
  readonly component: TEditorComponent<TRow> | undefined;
  readonly popup: boolean;
  readonly options: NonNullable<IEditorSpec<TRow>['options']>;
}

const EDITOR_KIND_BY_COLUMN_KIND: Readonly<Record<TColumnKind, TEditorKind | undefined>> = {
  text: 'text',
  number: 'number',
  date: 'date',
  datetime: 'datetime',
  boolean: 'checkbox',
  custom: undefined,
};

const POPUP_KINDS: ReadonlySet<TEditorKind> = new Set(['select', 'textarea']);

function builtIn<TRow>(kind: TEditorKind): TEditorComponent<TRow> | undefined {
  switch (kind) {
    case 'text':
      return TextEditor as TEditorComponent<TRow>;
    case 'number':
      return NumberEditor as TEditorComponent<TRow>;
    case 'date':
    case 'datetime':
      return DateEditor as TEditorComponent<TRow>;
    case 'select':
      return SelectEditor as TEditorComponent<TRow>;
    case 'textarea':
      return TextareaEditor as TEditorComponent<TRow>;
    case 'checkbox':
      return undefined;
  }
}

/** The editor of a cell: the column's `editor` (by kind or spec), else the default of the column kind; `undefined` means read-only. */
export function editorFor<TRow>(context: ICellContext<TRow>): IResolvedEditor<TRow> | undefined {
  const column = context.column as IColumn<TRow>;
  const declared =
    column.editor === undefined
      ? EDITOR_KIND_BY_COLUMN_KIND[column.kind]
      : resolve(column.editor, context);
  if (declared === undefined) {
    return undefined;
  }
  const spec: IEditorSpec<TRow> = typeof declared === 'string' ? { kind: declared } : declared;
  const kind =
    spec.kind ??
    (spec.component === undefined ? EDITOR_KIND_BY_COLUMN_KIND[column.kind] : undefined) ??
    'text';
  return {
    kind,
    component: spec.component ?? builtIn(kind),
    popup: spec.popup ?? POPUP_KINDS.has(kind),
    options: spec.options ?? {},
  };
}
