import { clientRows } from '@frozik/table/core/rows/client-rows';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import type { ICellContext, IColumn } from '@frozik/table/react/column';
import { sorting } from '@frozik/table/react/extensions/sorting/sorting';
import { Table } from '@frozik/table/react/Table';
import { useTable } from '@frozik/table/react/useTable';
import { observer } from 'mobx-react-lite';
import type { ReactNode, RefObject } from 'react';
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import type { TDemoTheme } from '../../application/TableDemoStore';
import { useTableDemoStore } from '../../application/useTableDemoStore';
import type { IDemoTrade } from '../../domain/demo-trade';
import { NUMBER_LOCALE } from '../numberLocale';
import { showcaseColumns } from '../showcaseColumns';
import { tableDemoT } from '../translations';

const SAMPLE_ROWS = 6;
const SAMPLE_COLUMN_IDS: readonly string[] = [
  'id',
  'symbol',
  'side',
  'price',
  'quantity',
  'status',
];

type TTokenKind = 'color' | 'size' | 'motion';

interface IToken {
  readonly name: string;
  readonly kind: TTokenKind;
}

const TOKENS: readonly IToken[] = [
  { name: '--table-bg', kind: 'color' },
  { name: '--table-bg-header', kind: 'color' },
  { name: '--table-bg-hover', kind: 'color' },
  { name: '--table-bg-selected', kind: 'color' },
  { name: '--table-bg-editing', kind: 'color' },
  { name: '--table-fg', kind: 'color' },
  { name: '--table-fg-muted', kind: 'color' },
  { name: '--table-fg-header', kind: 'color' },
  { name: '--table-border', kind: 'color' },
  { name: '--table-border-strong', kind: 'color' },
  { name: '--table-accent', kind: 'color' },
  { name: '--table-danger', kind: 'color' },
  { name: '--table-warning', kind: 'color' },
  { name: '--table-focus-ring', kind: 'color' },
  { name: '--table-skeleton', kind: 'color' },
  { name: '--table-skeleton-shine', kind: 'color' },
  { name: '--table-pin-shadow', kind: 'color' },
  { name: '--table-row-height', kind: 'size' },
  { name: '--table-header-height', kind: 'size' },
  { name: '--table-cell-padding-x', kind: 'size' },
  { name: '--table-font-size', kind: 'size' },
  { name: '--table-radius', kind: 'size' },
  { name: '--table-motion', kind: 'motion' },
  { name: '--table-shimmer', kind: 'motion' },
  { name: '--table-easing', kind: 'motion' },
];

type TState = keyof typeof tableDemoT.brandBook.stateNames;
const STATE_BY_ROW: readonly TState[] = ['focused', 'selected', 'invalid', 'edited'];

function Section({
  title,
  hint,
  children,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <MonoKicker>{title}</MonoKicker>
      {hint !== undefined && <p className="text-sm text-landing-fg-dim">{hint}</p>}
      {children}
    </section>
  );
}

/**
 * Reads what each token resolves to on the rendered root: colours through a
 * painted swatch (so `light-dark()` collapses to the theme's value), sizes
 * and motion straight from the custom property.
 */
function useTokenValues(rootRef: RefObject<HTMLDivElement | null>, theme: TDemoTheme) {
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const resolved: Record<string, string> = {};
    for (const token of TOKENS) {
      if (token.kind === 'color') {
        const swatch = root.querySelector<HTMLElement>(`[data-token="${token.name}"]`);
        resolved[token.name] = swatch === null ? '' : getComputedStyle(swatch).backgroundColor;
      } else {
        resolved[token.name] = getComputedStyle(root).getPropertyValue(token.name).trim();
      }
    }
    setValues(resolved);
  }, [rootRef, theme]);
  return values;
}

const TokenList = memo(({ theme }: { readonly theme: TDemoTheme }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const values = useTokenValues(rootRef, theme);
  return (
    <div
      ref={rootRef}
      className="ft rounded-lg border p-4"
      data-table-theme={theme}
      style={{ borderColor: 'var(--table-border-strong)' }}
    >
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {TOKENS.map(token => (
          <li
            key={token.name}
            className="flex items-center gap-3 rounded-md border px-3 py-2 font-mono text-xs"
            style={{ borderColor: 'var(--table-border)', background: 'var(--table-bg-header)' }}
          >
            {token.kind === 'color' ? (
              <span
                data-token={token.name}
                className="size-5 shrink-0 rounded border"
                style={{
                  background: `var(${token.name})`,
                  borderColor: 'var(--table-border-strong)',
                }}
              />
            ) : (
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded border text-[10px]"
                style={{
                  borderColor: 'var(--table-border-strong)',
                  color: 'var(--table-fg-muted)',
                }}
              >
                {token.kind === 'size' ? 'px' : 'ms'}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate" style={{ color: 'var(--table-fg)' }}>
                {token.name}
              </span>
              <span className="truncate" style={{ color: 'var(--table-fg-muted)' }}>
                {values[token.name] ?? ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

function useSampleTable(
  trades: readonly IDemoTrade[],
  columns: readonly IColumn<IDemoTrade, unknown>[],
  decorate?: IColumn<IDemoTrade, unknown>['decorate']
) {
  const decorated = useMemo(
    () => columns.map(column => (decorate === undefined ? column : { ...column, decorate })),
    [columns, decorate]
  );
  return useTable({
    columns: decorated,
    rowKey: 'id',
    rows: clientRows({ rows: () => trades }),
    extensions: [gridView({ layout: 'content' }), sorting()],
    context: undefined,
  });
}

const stateDecoration = ({ rowIndex, layout }: ICellContext<IDemoTrade>) => {
  const state = STATE_BY_ROW[rowIndex];
  if (state === undefined || layout.id !== 'price') {
    return undefined;
  }
  return { data: { [state]: true } };
};

export const BrandBookPage = observer(() => {
  const store = useTableDemoStore();
  const trades = useMemo(() => store.trades.slice(0, SAMPLE_ROWS), [store.trades]);
  const columns = useMemo(
    () => showcaseColumns(store.locale).filter(column => SAMPLE_COLUMN_IDS.includes(column.id)),
    [store.locale]
  );
  const light = useSampleTable(trades, columns);
  const dark = useSampleTable(trades, columns);
  const compact = useSampleTable(trades, columns);
  const states = useSampleTable(trades, columns, stateDecoration);

  return (
    <div className="ft-brand-book flex flex-col gap-10" data-table-theme={store.theme}>
      <Section title={tableDemoT.brandBook.tokens} hint={tableDemoT.brandBook.tokensHint}>
        <TokenList theme={store.theme} />
      </Section>
      <Section title={tableDemoT.brandBook.themes}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Table model={light} theme="light" locale={store.locale} numberLocale={NUMBER_LOCALE} />
          <Table model={dark} theme="dark" locale={store.locale} numberLocale={NUMBER_LOCALE} />
        </div>
      </Section>
      <Section title={tableDemoT.brandBook.density}>
        <Table
          model={compact}
          theme={store.theme}
          density="compact"
          locale={store.locale}
          numberLocale={NUMBER_LOCALE}
        />
      </Section>
      <Section title={tableDemoT.brandBook.states}>
        <Table
          model={states}
          theme={store.theme}
          locale={store.locale}
          numberLocale={NUMBER_LOCALE}
        />
        <p className="text-xs text-landing-fg-dim">
          {STATE_BY_ROW.map(state => tableDemoT.brandBook.stateNames[state]).join(' · ')}
        </p>
      </Section>
    </div>
  );
});
