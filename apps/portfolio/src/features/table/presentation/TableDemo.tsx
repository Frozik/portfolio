import '@frozik/table/theme/table.css';

import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '@frozik/components/components/cn';

import { Button } from '../../../shared/ui/Button';
import type { TDemoDensity, TDemoPage, TDemoTheme } from '../application/TableDemoStore';
import { useTableDemoStore } from '../application/useTableDemoStore';
import { BrandBookPage } from './pages/BrandBookPage';
import { ExtensionsPage } from './pages/ExtensionsPage';
import { ShowcasePage } from './pages/ShowcasePage';
import { SourcesPage } from './pages/SourcesPage';
import { tableDemoT } from './translations';

const PAGES: readonly TDemoPage[] = ['showcase', 'sources', 'extensions', 'brandBook'];
const THEMES: readonly TDemoTheme[] = ['auto', 'light', 'dark'];
const DENSITIES: readonly TDemoDensity[] = ['normal', 'compact'];
const ROW_COUNTS: readonly number[] = [100, 5_000, 100_000];

const SELECT_CLASS =
  'h-7 rounded-md border border-landing-border bg-landing-bg-elev px-2 text-xs text-landing-fg';

function Select<TValue extends string | number>({
  label,
  value,
  values,
  render,
  onChange,
}: {
  readonly label: string;
  readonly value: TValue;
  readonly values: readonly TValue[];
  readonly render: (value: TValue) => string;
  readonly onChange: (value: TValue) => void;
}) {
  const handleChange = useEventCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const next = values.find(candidate => String(candidate) === event.target.value);
    if (next !== undefined) {
      onChange(next);
    }
  });
  return (
    <label className="flex items-center gap-2 text-xs text-landing-fg-dim">
      {label}
      <select className={SELECT_CLASS} value={String(value)} onChange={handleChange}>
        {values.map(candidate => (
          <option key={String(candidate)} value={String(candidate)}>
            {render(candidate)}
          </option>
        ))}
      </select>
    </label>
  );
}

export const TableDemo = observer(() => {
  const store = useTableDemoStore();
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-6 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium tracking-tight text-landing-fg">
            {tableDemoT.title}
          </h1>
          <p className="max-w-xl text-sm text-landing-fg-dim">{tableDemoT.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            label={tableDemoT.controls.theme}
            value={store.theme}
            values={THEMES}
            render={theme => tableDemoT.controls.themes[theme]}
            onChange={store.setTheme}
          />
          <Select
            label={tableDemoT.controls.density}
            value={store.density}
            values={DENSITIES}
            render={density => tableDemoT.controls.densities[density]}
            onChange={store.setDensity}
          />
          <Select
            label={tableDemoT.controls.rows}
            value={store.rowCount}
            values={ROW_COUNTS}
            render={count => count.toLocaleString()}
            onChange={store.setRowCount}
          />
        </div>
      </header>
      <nav className="flex gap-2">
        {PAGES.map(page => (
          <Button
            key={page}
            variant={store.page === page ? 'primary' : 'ghost'}
            size="sm"
            className={cn(store.page !== page && 'text-landing-fg-dim')}
            onClick={() => store.setPage(page)}
          >
            {tableDemoT.pages[page]}
          </Button>
        ))}
      </nav>
      {store.page === 'showcase' ? (
        <ShowcasePage />
      ) : store.page === 'sources' ? (
        <SourcesPage />
      ) : store.page === 'extensions' ? (
        <ExtensionsPage />
      ) : (
        <BrandBookPage />
      )}
    </div>
  );
});
