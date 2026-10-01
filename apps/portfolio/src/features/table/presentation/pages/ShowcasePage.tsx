import { clientRows } from '@frozik/table/core/rows/client-rows';
import type { ISelectionMode } from '@frozik/table/core/selection/selection-port';
import type { TAutoSizeMode } from '@frozik/table/extensions/column-resize/core';
import { columnVisibility } from '@frozik/table/extensions/column-visibility/core';
import type { TCommitMode } from '@frozik/table/extensions/editing/contracts';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import { persistence } from '@frozik/table/extensions/persistence/core';
import { localStateStorage } from '@frozik/table/extensions/persistence/local-storage';
import { locationUrlPort } from '@frozik/table/extensions/persistence/location-url';
import { pinning } from '@frozik/table/extensions/pinning/core';
import type { ICellContext, IRowContext } from '@frozik/table/react/column';
import { clipboard } from '@frozik/table/react/extensions/clipboard/clipboard';
import { columnGroups } from '@frozik/table/react/extensions/column-groups/columnGroups';
import { columnMove } from '@frozik/table/react/extensions/column-move/columnMove';
import { columnResize } from '@frozik/table/react/extensions/column-resize/columnResize';
import { contextMenu } from '@frozik/table/react/extensions/context-menu/contextMenu';
import { detailRows } from '@frozik/table/react/extensions/detail-rows/detailRows';
import { editing } from '@frozik/table/react/extensions/editing/editing';
import { exporting } from '@frozik/table/react/extensions/export/exporting';
import { filtering } from '@frozik/table/react/extensions/filtering/filtering';
import { QuickFilter } from '@frozik/table/react/extensions/filtering/QuickFilter';
import { grouping } from '@frozik/table/react/extensions/grouping/grouping';
import { selection } from '@frozik/table/react/extensions/selection/selection';
import { sorting } from '@frozik/table/react/extensions/sorting/sorting';
import { tooltips } from '@frozik/table/react/extensions/tooltips/tooltips';
import { Table } from '@frozik/table/react/Table';
import { useTable } from '@frozik/table/react/useTable';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { assertNever } from '@frozik/utils/assert/assertNever';

import { Button } from '../../../../shared/ui/Button';
import { useTableDemoStore } from '../../application/useTableDemoStore';
import type { IDemoTrade } from '../../domain/demo-trade';
import { notionalOf } from '../../domain/demo-trade';
import { ExpandableFrame } from '../components/ExpandableFrame';
import { TradeDetail } from '../components/TradeDetail';
import { NUMBER_LOCALE } from '../numberLocale';
import { showcaseColumns } from '../showcaseColumns';
import { SPLIT_CLASS } from '../sidePanelLayout';
import { tableDemoT } from '../translations';

const ColumnPicker = lazy(() =>
  import('@frozik/table/react/extensions/column-visibility/ColumnPicker').then(module => ({
    default: module.ColumnPicker,
  }))
);

const GROUPS = [
  { id: 'instrument', title: tableDemoT.groups.instrument, columns: ['symbol', 'side'] },
  {
    id: 'execution',
    title: tableDemoT.groups.execution,
    columns: ['price', 'quantity', 'notional'],
  },
];

const COMMIT_MODES: readonly TCommitMode[] = ['immediate', 'confirm'];
const AUTOSIZE_MODES: readonly TAutoSizeMode[] = ['off', 'header', 'firstData', 'fit', 'grow'];
/** The apply / revert column only makes sense while rows wait for confirmation. */
const ACTIONS_COLUMN = 'actions';

const NEWEST_FIRST = {
  extensions: { sorting: [{ columnId: 'time', direction: 'desc' as const }] },
};

type TGroupChoice = 'none' | 'symbol' | 'symbolSide';

const GROUP_CHOICES: readonly TGroupChoice[] = ['none', 'symbol', 'symbolSide'];
const GROUP_BY: Readonly<Record<TGroupChoice, readonly string[]>> = {
  none: [],
  symbol: ['symbol'],
  symbolSide: ['symbol', 'side'],
};

function groupChoiceOf(groupBy: readonly string[]): TGroupChoice {
  return GROUP_CHOICES.find(choice => GROUP_BY[choice].join() === groupBy.join()) ?? 'none';
}

type TSelectionChoice = 'none' | 'single' | 'multiple' | 'cells';

const SELECTION_CHOICES: readonly TSelectionChoice[] = ['none', 'single', 'multiple', 'cells'];

function selectionChoiceOf(mode: ISelectionMode): TSelectionChoice {
  return mode.cells ? 'cells' : mode.rows;
}

function selectionModeOf(choice: TSelectionChoice): ISelectionMode {
  switch (choice) {
    case 'none':
    case 'single':
    case 'multiple':
      return { rows: choice, cells: false };
    case 'cells':
      return { rows: 'none', cells: true };
    default:
      return assertNever(choice);
  }
}

function hasFills(trade: IDemoTrade): boolean {
  return trade.status !== 'cancelled';
}

const LARGE_NOTIONAL = 10_000;
const SMALL_NOTIONAL = 10;

/** Rows tinted by size through the grid's `--table-row-bg`; selection and hover overlays stay visible on top. */
function notionalTint({ displayRow }: IRowContext<IDemoTrade>): string | undefined {
  if (displayRow.kind !== 'leaf') {
    return undefined;
  }
  const notional = notionalOf(displayRow.row);
  if (notional > LARGE_NOTIONAL) {
    return '[--table-row-bg:color-mix(in_srgb,var(--color-error)_16%,var(--table-bg))]';
  }
  return notional < SMALL_NOTIONAL
    ? '[--table-row-bg:color-mix(in_srgb,var(--color-success)_16%,var(--table-bg))]'
    : '[--table-row-bg:color-mix(in_srgb,var(--color-warning)_16%,var(--table-bg))]';
}

/** Cancelled trades are history: nothing on the row may change. */
function lockCancelled(context: ICellContext<IDemoTrade>) {
  return context.row.status === 'cancelled' && context.column.id !== 'status'
    ? { editable: false as const }
    : undefined;
}

const SELECT_CLASS =
  'h-7 rounded-md border border-landing-border bg-landing-bg-elev px-2 text-xs text-landing-fg';

export const ShowcasePage = observer(() => {
  const store = useTableDemoStore();
  const columns = useMemo(() => showcaseColumns(store.locale), [store.locale]);
  const model = useTable({
    id: 'table-showcase',
    columns,
    rowKey: 'id',
    rows: clientRows({ rows: () => store.trades }),
    extensions: [
      gridView(),
      sorting(),
      filtering({ filterRow: true }),
      grouping({ display: 'column', totals: { position: 'bottom', title: tableDemoT.totals } }),
      pinning(),
      columnResize(),
      columnMove(),
      columnVisibility(),
      columnGroups({ groups: GROUPS }),
      selection({ rows: 'multiple' }),
      clipboard(),
      exporting(),
      editing(),
      detailRows({ detail: TradeDetail, expandOn: 'doubleClick', hasDetail: hasFills }),
      contextMenu<IDemoTrade>({
        items: context =>
          context.row === undefined
            ? []
            : [
                {
                  id: 'demo.copySymbol',
                  label: tableDemoT.menu.copySymbol,
                  run: () => void navigator.clipboard.writeText(context.row?.symbol ?? ''),
                },
              ],
      }),
      tooltips(),
      persistence({ storage: localStateStorage(), url: { port: locationUrlPort() } }),
    ],
    initialState: NEWEST_FIRST,
    context: undefined,
    onRowsChange: changes => changes.forEach(change => store.updateTrade(change.new)),
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const togglePicker = useEventCallback(() => setPickerOpen(open => !open));
  const changeSelection = useEventCallback((event: ChangeEvent<HTMLSelectElement>) => {
    model.selection.setMode(selectionModeOf(event.target.value as TSelectionChoice));
  });
  const changeGroup = useEventCallback((event: ChangeEvent<HTMLSelectElement>) => {
    model.grouping.setGroupBy(GROUP_BY[event.target.value as TGroupChoice]);
  });
  const changeCommitMode = useEventCallback((event: ChangeEvent<HTMLSelectElement>) => {
    model.editing.setCommitMode(event.target.value as TCommitMode);
  });
  const changeAutoSize = useEventCallback((event: ChangeEvent<HTMLSelectElement>) => {
    model.columnResize.setAutoSizeMode(event.target.value as TAutoSizeMode);
  });
  const commitMode = model.editing.commitMode;
  useEffect(() => {
    model.columns.setVisible(ACTIONS_COLUMN, commitMode === 'confirm');
  }, [model, commitMode]);
  const toggleFilterRow = useEventCallback(() =>
    model.filtering.setFilterRow(!model.filtering.filterRow)
  );
  const copy = useEventCallback(() => model.clipboard.copy({ headers: true }));
  const exportCsv = useEventCallback(() => model.export.download('trades.csv', 'csv'));
  const selectedCount = model.selection.count ?? model.selection.summary?.cells ?? 0;

  return (
    <div className={SPLIT_CLASS}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={togglePicker}>
            {tableDemoT.controls.columns}
          </Button>
          <Button variant="ghost" size="sm" onClick={store.regenerate}>
            {tableDemoT.controls.regenerate}
          </Button>
          <Button
            variant={model.filtering.filterRow ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleFilterRow}
          >
            {tableDemoT.controls.filterRow}
          </Button>
          <QuickFilter model={model} locale={store.locale} />
          <label className="flex items-center gap-2 text-xs text-landing-fg-dim">
            {tableDemoT.controls.group}
            <select
              className={SELECT_CLASS}
              value={groupChoiceOf(model.grouping.groupBy)}
              onChange={changeGroup}
            >
              {GROUP_CHOICES.map(choice => (
                <option key={choice} value={choice}>
                  {tableDemoT.controls.groupModes[choice]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-landing-fg-dim">
            {tableDemoT.controls.selection}
            <select
              className={SELECT_CLASS}
              value={selectionChoiceOf(model.selection.mode)}
              onChange={changeSelection}
            >
              {SELECTION_CHOICES.map(choice => (
                <option key={choice} value={choice}>
                  {tableDemoT.controls.selectionModes[choice]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-landing-fg-dim">
            {tableDemoT.controls.commit}
            <select
              className={SELECT_CLASS}
              value={model.editing.commitMode}
              onChange={changeCommitMode}
            >
              {COMMIT_MODES.map(mode => (
                <option key={mode} value={mode}>
                  {tableDemoT.controls.commitModes[mode]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-landing-fg-dim">
            {tableDemoT.controls.autoSize}
            <select
              className={SELECT_CLASS}
              value={model.columnResize.autoSizeMode}
              onChange={changeAutoSize}
            >
              {AUTOSIZE_MODES.map(mode => (
                <option key={mode} value={mode}>
                  {tableDemoT.controls.autoSizeModes[mode]}
                </option>
              ))}
            </select>
          </label>
          <Button variant="ghost" size="sm" disabled={!model.selection.hasSelection} onClick={copy}>
            {tableDemoT.controls.copy}
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCsv}>
            {tableDemoT.controls.exportCsv}
          </Button>
          <span className="text-xs text-landing-fg-dim">
            {tableDemoT.controls.selected}: {selectedCount.toLocaleString()}
          </span>
        </div>
        <ExpandableFrame className="flex-1">
          <Table
            model={model}
            className="min-h-0 flex-1"
            theme={store.theme}
            density={store.density}
            locale={store.locale}
            numberLocale={NUMBER_LOCALE}
            cellSpec={lockCancelled}
            rowClass={notionalTint}
          />
        </ExpandableFrame>
      </div>
      {pickerOpen && (
        <Suspense fallback={null}>
          <ColumnPicker
            model={model}
            locale={store.locale}
            className="max-h-[35%] shrink-0 overflow-y-auto md:max-h-none md:self-start"
          />
        </Suspense>
      )}
    </div>
  );
});
