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
sizes it to its rows instead.

Every extension slice is typed on the model by its id (`model.sorting.set(…)`),
the kernel never mutates rows (edits go through `set` → `onRowChange`), and
the view is one more extension: nothing not plugged in is rendered or bundled.
