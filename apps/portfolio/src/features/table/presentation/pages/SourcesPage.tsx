import { clientRows } from '@frozik/table/core/rows/client-rows';
import { logRows } from '@frozik/table/core/rows/log-rows';
import { snapshotRows } from '@frozik/table/core/rows/snapshot-rows';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import { filtering } from '@frozik/table/react/extensions/filtering/filtering';
import { liveRows } from '@frozik/table/react/extensions/live-rows/liveRows';
import { sorting } from '@frozik/table/react/extensions/sorting/sorting';
import { Table } from '@frozik/table/react/Table';
import { useTable } from '@frozik/table/react/useTable';
import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';

import { cn } from '@frozik/components/components/cn';

import { Button } from '../../../../shared/ui/Button';
import type { TDemoSource } from '../../application/TableDemoStore';
import { useTableDemoStore } from '../../application/useTableDemoStore';
import { ApiReference } from '../components/ApiReference';
import { eventColumns } from '../eventColumns';
import { NUMBER_LOCALE } from '../numberLocale';
import { showcaseColumns } from '../showcaseColumns';
import { tableDemoT } from '../translations';

const SOURCES: readonly TDemoSource[] = ['client', 'snapshot', 'log'];

const ClientTable = observer(() => {
  const store = useTableDemoStore();
  const columns = useMemo(() => showcaseColumns(store.locale), [store.locale]);
  const model = useTable({
    columns,
    rowKey: 'id',
    rows: clientRows({ rows: () => store.trades }),
    extensions: [gridView(), sorting(), filtering({ filterRow: true })],
    context: undefined,
  });
  return <SourceView model={model} />;
});

const SnapshotTable = observer(() => {
  const store = useTableDemoStore();
  const columns = useMemo(() => showcaseColumns(store.locale), [store.locale]);
  const model = useTable({
    columns,
    rowKey: 'id',
    rows: snapshotRows({ subscribe: store.snapshotSubscribe(() => columns) }),
    extensions: [gridView(), sorting(), filtering({ filterRow: true })],
    context: undefined,
  });
  return <SourceView model={model} />;
});

const LogTable = observer(() => {
  const store = useTableDemoStore();
  const columns = useMemo(() => eventColumns(store.locale), [store.locale]);
  const model = useTable({
    columns,
    rowKey: 'id',
    rows: logRows({
      time: event => event.at,
      timeColumnId: 'at',
      ...store.eventLog,
    }),
    extensions: [gridView(), sorting(), filtering({ filterRow: true }), liveRows()],
    context: undefined,
    initialState: { extensions: { sorting: [{ columnId: 'at', direction: 'desc' }] } },
  });
  return <SourceView model={model} />;
});

const SourceView = observer(function SourceView<TRow>({
  model,
}: {
  readonly model: Parameters<typeof Table<TRow>>[0]['model'];
}) {
  const store = useTableDemoStore();
  const { rows } = model;
  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <Table
        model={model}
        className="min-h-0 flex-1"
        theme={store.theme}
        density={store.density}
        locale={store.locale}
        numberLocale={NUMBER_LOCALE}
      />
      <aside className="flex w-64 shrink-0 flex-col gap-3 text-xs text-landing-fg-dim">
        <div className="flex items-start justify-between gap-2">
          <p>{tableDemoT.sources.hint[store.source]}</p>
          {store.source !== 'client' && <ApiReference source={store.source} />}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>{tableDemoT.sources.epoch}</dt>
          <dd className="text-landing-fg">{rows.epoch}</dd>
          <dt>{tableDemoT.sources.rows}</dt>
          <dd className="text-landing-fg">
            {rows.rowCount === undefined
              ? tableDemoT.sources.unknown
              : rows.rowCount.toLocaleString()}
            {rows.hasMore && ` · ${tableDemoT.sources.hasMore}`}
          </dd>
        </dl>
        {store.source !== 'client' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-landing-fg">{tableDemoT.sources.serverLog}</span>
              <Button variant="ghost" size="sm" onClick={store.toggleServerLogPause}>
                {store.serverLogPaused ? tableDemoT.sources.resumeLog : tableDemoT.sources.pauseLog}
              </Button>
            </div>
            <ol className="flex flex-col gap-0.5 font-mono text-[11px]">
              {store.serverLog.map((line, index) => (
                <li key={index} className="truncate">
                  {line}
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </div>
  );
});

export const SourcesPage = observer(() => {
  const store = useTableDemoStore();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex gap-2">
        {SOURCES.map(source => (
          <Button
            key={source}
            variant={store.source === source ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(store.source !== source && 'text-landing-fg-dim')}
            onClick={() => store.setSource(source)}
          >
            {tableDemoT.sources[source]}
          </Button>
        ))}
      </div>
      {store.source === 'client' ? (
        <ClientTable />
      ) : store.source === 'snapshot' ? (
        <SnapshotTable key={store.rowCount} />
      ) : (
        <LogTable />
      )}
    </div>
  );
});
