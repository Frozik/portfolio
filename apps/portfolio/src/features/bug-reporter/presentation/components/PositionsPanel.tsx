import { clientRows } from '@frozik/table/core/rows/client-rows';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import { sorting } from '@frozik/table/react/extensions/sorting/sorting';
import { Table } from '@frozik/table/react/Table';
import { useTable } from '@frozik/table/react/useTable';
import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';

import { useBugReporterDemoStore } from '../../application/useBugReporterDemoStore';
import { NUMBER_LOCALE } from '../money';
import { positionColumns } from '../positionColumns';
import { bugReporterDemoT } from '../translations';
import { DeskPanel } from './DeskPanel';

export const PositionsPanel = observer(() => {
  const store = useBugReporterDemoStore();
  const columns = useMemo(() => positionColumns(), []);
  const model = useTable({
    id: 'bug-reporter-positions',
    columns,
    rowKey: 'id',
    rows: clientRows({ rows: () => store.desk.positions }),
    extensions: [gridView({ layout: 'content' }), sorting()],
    context: undefined,
  });
  return (
    <DeskPanel title={bugReporterDemoT.panels.positions} className="lg:col-span-2">
      <Table
        model={model}
        theme="auto"
        density="compact"
        locale={store.locale}
        numberLocale={NUMBER_LOCALE}
      />
    </DeskPanel>
  );
});
