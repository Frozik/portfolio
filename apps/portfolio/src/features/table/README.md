# Table

Showcase and brand book of `@frozik/table`, a data grid built as a headless MobX kernel plus extensions, the visible grid included.

Live: [https://frozik.github.io/portfolio/table](https://frozik.github.io/portfolio/table) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/table/`; the library lives in [`libs/table`](../../../../../libs/table/README.md).

The feature is the library's living documentation: whatever is not shown
here is not considered done. It is laid out like every other feature —
`domain/` (deterministic demo trades), `application/` (the MobX store with
the showcase settings and the rows every page shares), `presentation/`
(the shell and its pages).

**Showcase** — one table over 100 to 100 000 generated trades with the
extensions of the first release wired in: sorting (click cycles, Shift+click
adds a column, priority badges), pinning, column resizing (drag handle,
double-click fits the content), column reordering by dragging headers,
column visibility through a searchable picker, sticky pinned columns with a
scroll shadow, virtualised rows and columns, keyboard navigation with a
roving focus, and the table state persisted in `localStorage` and shareable
through the URL. Selection switches at runtime between one row, many rows
(checkbox column with an all / some / none header, Shift and Ctrl/⌘ clicks,
Space and Shift+Space) and cell blocks (drag, Shift+arrows, Ctrl/⌘+A).
Ctrl/⌘+C copies what is selected as TSV, the Copy button adds headers, and
Export CSV downloads every row over the visible columns. Filtering shows
every spec kind at once: text and number conditions (up to two, and / or),
a date range in UTC with relative windows, sets that accumulate the values
they meet (symbol, venue) or come fixed (status), an enum for the side, plus
the quick search box over the text columns with an optional regexp mode.
The filter row under the header edits the simple case inline; the funnel
in a header opens the full editor. Grouping nests trades by symbol, or by
symbol and side, with sums, averages and counts on the group rows and a
totals row pinned below the body. Rows are tinted by the size of the trade
through `rowClass` setting the grid's `--table-row-bg` (green under 10,
orange up to 10 000, red above); the selection and hover overlays stay visible
on top of the tint. Editing starts with
Enter, F2, a double click or by typing: price and quantity open the numeric
editor with validation (an error blocks, a warning only marks), the price of
a filled trade is final (the column's `editable` rule over the row), side and
status open a select list, the note opens a text field or a textarea
depending on its length, and cancelled trades are locked through a
table-level `cellSpec`. Every cell is one component with a view and an edit mode: price and quantity
are `numberCell`, side and status are `selectCell` with their own view
component (the coloured side, the status tag), the venue is the default
`TextCell`, the note is `TextCell` or a `textareaCell` by length. Dragging a header
reorders columns; a column dropped inside the "Instrument" or "Execution"
group joins it, dropped beside it leaves, and dropped on the group's own
header becomes its first or last column. The autosize
control switches how the columns without a declared width follow their
content (grow only by default, fit both ways, once by the first rows or by
the header, or off). The commit
control switches between sending every
edit at once and confirming by row: in the latter a row-actions column
appears at the end with apply and revert for an edited row, calling the row
API of the editing slice. Every commit goes to the store as a new row; the
kernel never mutates data. A double click on a row (or the arrow in the
first column) opens its detail: a nested compact table of the fills the
trade was assembled from, with its own model and id. A right click (or
Shift+F10) opens the context menu assembled from every extension plus the
demo's own item; hovering a status shows a tooltip component with the fill
count, the notional header explains the heatmap, and truncated notes show
their full text. The theme, density
and language switches in the header act on every page without re-creating
the models.

**Sources** — the same trades behind two sources: the client source with
every row in memory, and a snapshot source backed by an in-memory fake
server that answers one window per sort and filter set after a delay, then
pushes price upserts and removals that the client re-filters and re-sorts
itself, and a log source over a fake event journal: history arrives in
time chunks as you scroll, live events join at the top while you are there
and wait behind a "N new rows" chip otherwise. The side panel shows the
epoch, the row count and the server log.

**Extensions** — every extension can be switched off and the model is
rebuilt with the new set: its parts of the UI disappear with it. The page
also shows an extension written in place by the application (a guard that
keeps the symbol column visible, a menu item, a header part, an override
that hides the sort indicators) and the card list, a second representation
over the same kernel and virtual window.

**Brand book** — the tokens every colour and size comes from (`--table-*`
CSS variables on the table root), the light and dark themes side by side,
the compact density, and the cell states (`focused`, `selected`, `invalid`,
`edited`) as `data-*` attributes a theme styles.

Pages arrive with the implementation phases of the library: sources
(client / snapshot / log), cells and editors, extensions.
