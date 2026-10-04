import { clientRows } from '@frozik/table/core/rows/client-rows';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import { sorting } from '@frozik/table/react/extensions/sorting/sorting';
import { Table } from '@frozik/table/react/Table';
import { useTable } from '@frozik/table/react/useTable';
import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import type { EchoModel } from '../../application/EchoModel';
import { transportT } from '../translations';
import { echoResultColumns } from './echo-result-columns';

/** Every finished echo stays, newest first, so the two transports can be compared side by side. */
export const EchoResults = observer(({ echo }: { readonly echo: EchoModel }) => {
  const columns = useMemo(() => echoResultColumns(), []);
  const model = useTable({
    id: 'transport-echo-results',
    columns,
    rowKey: 'id',
    rows: clientRows({ rows: () => echo.results }),
    extensions: [gridView({ layout: 'content' }), sorting()],
    context: undefined,
  });
  if (echo.results.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[11px] tracking-[0.1em] text-landing-fg-faint uppercase">
        {transportT.echo.results}
      </h3>
      <Table model={model} theme="auto" density="compact" locale={getCurrentLanguage()} />
    </section>
  );
});
