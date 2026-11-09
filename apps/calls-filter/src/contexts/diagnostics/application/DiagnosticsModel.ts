import { assertNever } from '@frozik/utils/assert/assertNever';
import { action, computed, makeObservable, observableRef } from 'mobx';

import type { IClock } from '../../policy/domain/ports/clock';
import type { IDiagnosticsEntry, TDiagnosticsLevel } from '../domain/diagnostics-entry';
import type { IExportHeader } from '../domain/export-file';
import { diagnosticsFile } from '../domain/export-file';
import type { IDiagnosticsLog } from '../domain/ports/diagnostics-log';
import type { TShareFile } from '../domain/ports/file-share';

const SHOWN = 500;
const COPIED = 200;
const EXPORTED = 5_000;
const ERROR_WINDOW_HOURS = 24;

export type TDiagnosticsFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'errors' }
  | { readonly kind: 'category'; readonly category: string };

/** The diagnostics screen: the latest entries, a filter, and the file to share. */
export class DiagnosticsModel {
  entries: readonly IDiagnosticsEntry[] = [];
  filter: TDiagnosticsFilter = { kind: 'all' };

  constructor(
    private readonly log: IDiagnosticsLog,
    private readonly share: TShareFile,
    private readonly clock: IClock,
    private readonly header: () => IExportHeader
  ) {
    makeObservable(this, {
      entries: observableRef,
      filter: observableRef,
      shown: computed,
      categories: computed,
      hasRecentErrors: computed,
      refresh: action,
      setFilter: action,
    });
  }

  refresh(): void {
    this.entries = this.log.latest(SHOWN);
  }

  setFilter(filter: TDiagnosticsFilter): void {
    this.filter = filter;
  }

  get shown(): readonly IDiagnosticsEntry[] {
    const { filter } = this;
    switch (filter.kind) {
      case 'all':
        return this.entries;
      case 'errors':
        return this.entries.filter(entry => isProblem(entry.level));
      case 'category':
        return this.entries.filter(entry => entry.category === filter.category);
      default:
        return assertNever(filter);
    }
  }

  get categories(): readonly string[] {
    return [...new Set(this.entries.map(entry => entry.category))].sort();
  }

  get hasRecentErrors(): boolean {
    const since = this.clock.now().subtract({ hours: ERROR_WINDOW_HOURS }).epochMilliseconds;
    return this.entries.some(
      entry => entry.level === 'error' && entry.at.epochMilliseconds >= since
    );
  }

  async shareFile(): Promise<'shared' | 'unavailable' | 'failed'> {
    return this.share(diagnosticsFile(this.header(), this.log.latest(EXPORTED), this.clock.now()));
  }

  copyText(): string {
    return diagnosticsFile(this.header(), this.log.latest(COPIED), this.clock.now()).text;
  }
}

function isProblem(level: TDiagnosticsLevel): boolean {
  return level === 'warn' || level === 'error';
}
