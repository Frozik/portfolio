import type { ITableExtension } from '@frozik/table/core/kernel/extension';
import { clientRows } from '@frozik/table/core/rows/client-rows';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import { appExtension } from '@frozik/table/react/extensions/appExtension';
import { contextMenu } from '@frozik/table/react/extensions/context-menu/contextMenu';
import { detailRows } from '@frozik/table/react/extensions/detail-rows/detailRows';
import { editing } from '@frozik/table/react/extensions/editing/editing';
import { filtering } from '@frozik/table/react/extensions/filtering/filtering';
import { listView } from '@frozik/table/react/extensions/grid-view/listView';
import { grouping } from '@frozik/table/react/extensions/grouping/grouping';
import { selection } from '@frozik/table/react/extensions/selection/selection';
import { sorting } from '@frozik/table/react/extensions/sorting/sorting';
import { tooltips } from '@frozik/table/react/extensions/tooltips/tooltips';
import { Table } from '@frozik/table/react/Table';
import { useTable } from '@frozik/table/react/useTable';
import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';

import { cn } from '@frozik/components/components/cn';
import type { TDemoExtension, TDemoView } from '../../application/TableDemoStore';

import { ExpandableFrame } from '../../../../shared/ui/ExpandableFrame';
import { useTableDemoStore } from '../../application/useTableDemoStore';
import type { IDemoTrade } from '../../domain/demo-trade';
import { TradeDetail } from '../components/TradeDetail';
import { NUMBER_LOCALE } from '../numberLocale';
import { showcaseColumns } from '../showcaseColumns';
import { SIDE_PANEL_CLASS, SPLIT_CLASS } from '../sidePanelLayout';

import { tableDemoT } from '../translations';

const EXTENSIONS: readonly TDemoExtension[] = [
  'sorting',
  'filtering',
  'grouping',
  'selection',
  'editing',
  'detailRows',
  'contextMenu',
  'tooltips',
  'app',
];
const VIEWS: readonly TDemoView[] = ['grid', 'list'];

const LiveBadge = () => <span className="ft-group-level">{tableDemoT.extensions.liveBadge}</span>;

/** Everything an application may add without touching the library: a guard, a menu item, a header part, an override. */
function demoAppExtension(): ITableExtension<IDemoTrade, 'app', undefined> {
  return appExtension<IDemoTrade, 'app'>('app', {
    guards: {
      'columns.setVisible': ({ columnId, visible }) =>
        columnId === 'symbol' && !visible ? tableDemoT.extensions.symbolLocked : undefined,
    },
    menu: ({ row }) =>
      row === undefined
        ? []
        : [
            {
              id: 'app.copySymbol',
              label: tableDemoT.menu.copySymbol,
              run: () => void navigator.clipboard.writeText(row.symbol),
            },
          ],
    view: {
      'header.cell.parts': [
        {
          id: 'app.live',
          render: LiveBadge,
          active: ({ column }) => column.id === 'price',
        },
      ],
    },
    overrides: { 'sorting.indicator': false },
  });
}

function extensionsFor(enabled: ReadonlySet<TDemoExtension>, view: TDemoView) {
  return [
    view === 'list' ? listView<IDemoTrade>() : gridView<IDemoTrade>(),
    ...(enabled.has('sorting') ? [sorting<IDemoTrade>()] : []),
    ...(enabled.has('filtering') ? [filtering<IDemoTrade>({ filterRow: true })] : []),
    ...(enabled.has('grouping')
      ? [grouping<IDemoTrade>({ groupBy: ['symbol'], defaultExpanded: 1 })]
      : []),
    ...(enabled.has('selection')
      ? [selection<IDemoTrade>({ rows: 'multiple', checkboxes: true })]
      : []),
    ...(enabled.has('editing') ? [editing<IDemoTrade>()] : []),
    ...(enabled.has('detailRows')
      ? [detailRows<IDemoTrade>({ detail: TradeDetail, expandOn: 'doubleClick' })]
      : []),
    ...(enabled.has('contextMenu') ? [contextMenu<IDemoTrade>()] : []),
    ...(enabled.has('tooltips') ? [tooltips<IDemoTrade>()] : []),
    ...(enabled.has('app') ? [demoAppExtension()] : []),
  ];
}

const ExtensionsTable = observer(() => {
  const store = useTableDemoStore();
  const columns = useMemo(() => showcaseColumns(store.locale), [store.locale]);
  const model = useTable({
    columns,
    rowKey: 'id',
    rows: clientRows({ rows: () => store.trades }),
    extensions: extensionsFor(store.enabled, store.view),
    context: undefined,
    onRowsChange: changes => changes.forEach(change => store.updateTrade(change.new)),
  });
  return (
    <ExpandableFrame className="flex-1">
      <Table
        model={model}
        className="min-h-0 flex-1"
        theme={store.theme}
        density={store.density}
        locale={store.locale}
        numberLocale={NUMBER_LOCALE}
      />
    </ExpandableFrame>
  );
});

export const ExtensionsPage = observer(() => {
  const store = useTableDemoStore();
  return (
    <div className={SPLIT_CLASS}>
      <ExtensionsTable key={`${store.extensionsKey}:${store.view}`} />
      <aside className={cn('flex flex-col gap-3 text-xs text-landing-fg-dim', SIDE_PANEL_CLASS)}>
        <p>{tableDemoT.extensions.hint}</p>
        <label className="flex items-center gap-2">
          {tableDemoT.extensions.view}
          <select
            className="h-7 rounded-md border border-landing-border bg-landing-bg-elev px-2 text-xs text-landing-fg"
            value={store.view}
            onChange={event => store.setView(event.target.value as TDemoView)}
          >
            {VIEWS.map(view => (
              <option key={view} value={view}>
                {tableDemoT.extensions.views[view]}
              </option>
            ))}
          </select>
        </label>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 md:flex-col md:flex-nowrap">
          {EXTENSIONS.map(extension => (
            <li key={extension}>
              <label className="flex items-center gap-2 text-landing-fg">
                <input
                  type="checkbox"
                  checked={store.enabled.has(extension)}
                  onChange={() => store.toggleExtension(extension)}
                />
                {tableDemoT.extensions.names[extension]}
              </label>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
});
