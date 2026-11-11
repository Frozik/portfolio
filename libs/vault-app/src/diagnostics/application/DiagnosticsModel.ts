import { assertNever } from '@frozik/utils/assert/assertNever';
import { makeAutoObservable, observableRef } from 'mobx';
import { Temporal } from 'temporal-polyfill';

import type { ISessionClock } from '../../session/domain/ports/session-clock';
import type { IDiagnosticsEntry, TDiagnosticsCategory } from '../domain/diagnostics-entry';
import { DIAGNOSTICS_CATEGORIES } from '../domain/diagnostics-entry';
import type { TDiagnosticsTerm } from '../domain/diagnostics-terms';
import type { IDiagnosticsHeader } from '../domain/diagnostics-text';
import { diagnosticsText } from '../domain/diagnostics-text';
import type { IDiagnosticsJournal } from '../domain/ports/diagnostics-journal';

/** The screen reads this many of the newest entries; the copy takes what the filter shows of them. */
const SHOWN = 500;
const DAY_HOURS = 24;

export type TDiagnosticsFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'problems' }
  | { readonly kind: 'category'; readonly category: TDiagnosticsCategory };

/** The diagnostics page: the newest entries through a filter, how long they are kept, and the copy. */
export class DiagnosticsModel {
  entries: readonly IDiagnosticsEntry[] = [];
  filter: TDiagnosticsFilter = { kind: 'all' };
  term: TDiagnosticsTerm;

  constructor(
    private readonly journal: IDiagnosticsJournal,
    private readonly clock: Pick<ISessionClock, 'now'>
  ) {
    this.term = journal.term();
    makeAutoObservable<DiagnosticsModel, 'journal' | 'clock'>(
      this,
      { entries: observableRef, filter: observableRef, journal: false, clock: false },
      { autoBind: true }
    );
    this.dropExpired();
  }

  refresh(): void {
    this.entries = this.journal.latest(SHOWN);
  }

  setFilter(filter: TDiagnosticsFilter): void {
    this.filter = filter;
  }

  /** A shorter term drops at once what it no longer keeps. */
  setTerm(term: TDiagnosticsTerm): void {
    this.term = term;
    this.journal.setTerm(term);
    this.dropExpired();
    this.refresh();
  }

  get shown(): readonly IDiagnosticsEntry[] {
    const { filter } = this;
    switch (filter.kind) {
      case 'all':
        return this.entries;
      case 'problems':
        return this.entries.filter(entry => entry.level !== 'info');
      case 'category':
        return this.entries.filter(entry => entry.category === filter.category);
      default:
        return assertNever(filter);
    }
  }

  /** The categories the log holds now, in the app's own order. */
  get categories(): readonly TDiagnosticsCategory[] {
    const present = new Set(this.entries.map(entry => entry.category));
    return DIAGNOSTICS_CATEGORIES.filter(category => present.has(category));
  }

  copyText(header: IDiagnosticsHeader): string {
    return diagnosticsText(header, this.shown, this.now());
  }

  private dropExpired(): void {
    this.journal.dropBefore(this.now().subtract({ hours: this.term * DAY_HOURS }));
  }

  private now(): Temporal.Instant {
    return Temporal.Instant.fromEpochMilliseconds(this.clock.now());
  }
}
