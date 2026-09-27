import type { TAnyColumn } from '@frozik/table/core/columns/column';
import { makeAutoObservable } from 'mobx';

import { getCurrentLanguage } from '../../../shared/i18n/locale';
import type { IDemoTrade } from '../domain/demo-trade';
import { generateTrades } from '../domain/demo-trade';
import { fakeLogServer } from '../infrastructure/fakeLogServer';
import { fakeSnapshotServer } from '../infrastructure/fakeSnapshotServer';

export type TDemoTheme = 'auto' | 'light' | 'dark';
export type TDemoDensity = 'normal' | 'compact';
export type TDemoLocale = 'en' | 'ru';
export type TDemoPage = 'showcase' | 'sources' | 'extensions' | 'brandBook';
export type TDemoExtension =
  | 'sorting'
  | 'filtering'
  | 'grouping'
  | 'selection'
  | 'editing'
  | 'detailRows'
  | 'contextMenu'
  | 'tooltips'
  | 'app';
export type TDemoView = 'grid' | 'list';
export type TDemoSource = 'client' | 'snapshot' | 'log';

const DEFAULT_ROW_COUNT = 5_000;
const SERVER_LOG_LINES = 8;

/** Settings of the showcase and the rows every page shares. */
export class TableDemoStore {
  theme: TDemoTheme = 'dark';
  density: TDemoDensity = 'normal';
  locale: TDemoLocale = getCurrentLanguage() === 'ru' ? 'ru' : 'en';
  page: TDemoPage = 'showcase';
  source: TDemoSource = 'snapshot';
  view: TDemoView = 'grid';
  enabled: ReadonlySet<TDemoExtension> = new Set<TDemoExtension>([
    'sorting',
    'filtering',
    'grouping',
    'selection',
    'editing',
    'detailRows',
    'contextMenu',
    'tooltips',
    'app',
  ]);
  serverLog: readonly string[] = [];
  serverLogPaused = false;
  rowCount = DEFAULT_ROW_COUNT;
  /** The fake journal behind the log source; one per store so its live stream survives tab switches. */
  readonly eventLog = fakeLogServer({ log: text => this.appendServerLog(text) });
  private seed = 1;
  private edits: ReadonlyMap<number, IDemoTrade> = new Map();

  constructor() {
    makeAutoObservable<TableDemoStore, 'seed' | 'edits'>(
      this,
      { eventLog: false, seed: false, edits: true, snapshotSubscribe: false },
      { autoBind: true }
    );
  }

  /** The fake snapshot server over the current trades; the columns give it the client's own sort and filter rules. */
  snapshotSubscribe(columns: () => readonly TAnyColumn<IDemoTrade>[]) {
    return fakeSnapshotServer({ rows: () => this.trades, columns, log: this.appendServerLog });
  }

  get trades(): readonly IDemoTrade[] {
    const generated = generateTrades(this.rowCount, this.seed);
    return this.edits.size === 0
      ? generated
      : generated.map(trade => this.edits.get(trade.id) ?? trade);
  }

  updateTrade(next: IDemoTrade): void {
    this.edits = new Map([...this.edits, [next.id, next]]);
  }

  setTheme(theme: TDemoTheme): void {
    this.theme = theme;
  }

  setDensity(density: TDemoDensity): void {
    this.density = density;
  }

  setLocale(locale: TDemoLocale): void {
    this.locale = locale;
  }

  setPage(page: TDemoPage): void {
    this.page = page;
  }

  setSource(source: TDemoSource): void {
    this.source = source;
  }

  setView(view: TDemoView): void {
    this.view = view;
  }

  toggleExtension(extension: TDemoExtension): void {
    const next = new Set(this.enabled);
    if (next.has(extension)) {
      next.delete(extension);
    } else {
      next.add(extension);
    }
    this.enabled = next;
  }

  /** Changes with the set of extensions, so a page can rebuild its model when the set does. */
  get extensionsKey(): string {
    return [...this.enabled].sort().join('+');
  }

  appendServerLog(text: string): void {
    if (this.serverLogPaused) {
      return;
    }
    this.serverLog = [...this.serverLog.slice(-(SERVER_LOG_LINES - 1)), text];
  }

  toggleServerLogPause(): void {
    this.serverLogPaused = !this.serverLogPaused;
  }

  setRowCount(rowCount: number): void {
    this.rowCount = rowCount;
  }

  regenerate(): void {
    this.seed += 1;
    this.edits = new Map();
  }

  dispose(): void {
    // Nothing to release: the store holds no subscriptions.
  }
}
