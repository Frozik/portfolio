# @frozik/table

A data grid built as a headless MobX kernel plus extensions — sorting,
filtering, grouping, selection, editing and the visible grid itself are all
extensions of the same kernel, so nothing that is not plugged in is rendered
or bundled. React is the first adapter; the kernel and every extension core
are free of React and the DOM.

The design specification (in Russian, kept with the repository's other design
documents under `.claude/plan/design/table/spec.md`) covers the principles,
data sources (`clientRows`, `snapshotRows`, `logRows`), the extension
contract, view slots, theming, budgets and the implementation phases; the
`§` citations in the source refer to it.

```
src/
  core/         kernel: columns, rows (clientRows, snapshotRows, logRows), focus, state, extension registry
  extensions/   <id>/core.ts — the framework-free part of every extension
  react/        adapter: useTable, Table, slots, translations, the React part of every extension
  theme/        tokens and the light / dark themes
```

Extensions of the first release: `gridView` (the grid itself; `listView` is a
card prototype over the same slots), `sorting`, `pinning`, `columnResize`,
`columnMove`, `columnVisibility`, `columnGroups`, `persistence`, `selection`,
`clipboard`, `exporting`, `filtering`, `grouping`, `editing`, `detailRows`,
`contextMenu`, `tooltips`, `liveRows`. The application adds its own with
`appExtension` (guards, menu items, keys, view parts, overrides by id).

```ts
const model = useTable({
  id: 'trades',
  columns,
  rowKey: 'id',
  rows: clientRows({ rows: () => store.trades }),
  extensions: [gridView(), sorting(), filtering({ filterRow: true }), selection({ rows: 'multiple' })],
  context: undefined,
});
<Table model={model} theme="auto" locale="en" />
```

`<Table>` owns its scrolling: with the default `fill` layout it never grows
past the box it is in, and when that box has no height of its own the React
adapter caps the root at what is left of the screen below it, so the rows
always scroll inside the table rather than the page. `layout: 'content'`
sizes it to its rows instead. Width works the same way: the scroll container
is contained in the inline axis, so a row wider than the box scrolls inside
the table instead of stretching a flex or grid parent to the row's width.

Columns without a `width` of their own size themselves to what is rendered
through the `columnResize` extension's autosize mode: `grow` (the default)
widens a column whenever wider content or a wider header is rendered and
never narrows it, `fit` follows the content both ways, `firstData` sizes
each column once by the header and the first rows, `header` once by the
header alone, `off` never. A declared `width` wins, a `flex` or `wrap`
column and a width the user dragged are left alone, and the result stays
between the column's `minWidth` and `maxWidth` (`autoSizeMaxWidth`, 400 px,
is the ceiling of a column without one). Measurement reads the rendered
header and cells, so what is scrolled in decides; the menu's "fit column"
and a double-click on the resize handle still fit on request, uncapped.

A column's group is part of the table state, not only of the definition:
dropped between two columns of a group it joins that group, dropped beside
a group it leaves its own, and dropped on a group's header (which lights up
while the pointer is over it) it becomes the group's first or last column.
The context menu opens on a cell, a column header or a column group's
header; a group offers to pin itself as one, to unpin, and to hide its
columns, next to the table-level items.

Every extension slice is typed on the model by its id (`model.sorting.set(…)`),
the kernel never mutates rows (edits go through `set` → `onRowChange`), and
the view is one more extension: nothing not plugged in is rendered or bundled.

A cell is one component for both of its modes. It receives the cell context
plus `mode` (`'view'` or `'edit'`, set by the table's editing session),
`editable` (the column opted in with `editable: true` or a rule over the row
and the cell, and the table rules and the row state allow it; a column
without `editable` is read-only even with `set`)
and `edit` — the session's draft with `update` / `commit` / `cancel`, and
`change(value)` for a value produced without a session. On an `interactive`
column the table passes no mode: the component decides its mode itself and
reports through `edit.change`. The built-ins cover the column kinds —
`TextCell`, `numberCell(options)`, `dateCell(options)`, `BooleanCell` (flips
without a session) — plus `selectCell({ values, view })` and
`textareaCell(options)`, which keep the view and open under the cell. A
view-only component takes the subset of props it needs.

Confirmed edits reach the application as an array through `onRowsChange`:
one entry per row with `old`, `new`, `rowKey` and the edited `fields`. With
`commitMode: 'immediate'` every commit is sent at once; with `'confirm'` a
row keeps its edits (shown, marked `data-edited`) until a control calls the
row API — `model.editing.confirm(rowKey)` / `revert(rowKey)`, or
`confirmAll()` for every pending row in one call. A row that arrives anew
from the source while it is edited follows the `incoming` policy: `hold`
(default) keeps showing what is being edited until the edit ends, `apply`
shows the new version and drops the edit.
