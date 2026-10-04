import type { BugReporter } from '@frozik/bug-reporter/reporter/bug-reporter';
import { createBugReporter } from '@frozik/bug-reporter/reporter/create-bug-reporter';
import { makeAutoObservable, runInAction } from 'mobx';

import { getCurrentLanguage } from '../../../shared/i18n/locale';
import type { IDesk } from '../domain/desk';
import { generateDesk } from '../domain/generate-desk';

export type TDeskPanel = 'accounts' | 'positions' | 'news' | 'symptoms';
export type TSymptom = 'transfer' | 'recalculate' | 'quotes' | 'shuffle' | 'console';

export interface IActivityLine {
  readonly id: number;
  readonly symptom: TSymptom;
}

const DESK_SEED = 2026;
const BUSY_WORK_MS = 400;
const CONSOLE_FLOOD_LINES = 40;
const MAX_ACTIVITY = 12;
const CHECKSUM_MODULO = 1_000;
const FLOOD_QUEUES = 7;
const FLOOD_LAG_STEP_MS = 3;
/** A host that does not resolve, so the request fails the same way offline and online. */
const QUOTES_ENDPOINT = 'https://quotes.example.invalid/api/v1/quotes';
const STREAM_SAVER_MITM = `${import.meta.env.BASE_URL}stream-saver/mitm.html`;

/** The mock desk and the controls that make it misbehave on purpose, so a report has something to show. */
export class BugReporterDemoStore {
  readonly desk: IDesk = generateDesk(DESK_SEED);
  readonly locale = getCurrentLanguage();
  readonly reporter: BugReporter;
  panels: readonly TDeskPanel[] = ['accounts', 'positions', 'news', 'symptoms'];
  activity: readonly IActivityLine[] = [];
  quotesPending = false;
  private activitySeq = 0;

  constructor() {
    this.reporter = createBugReporter({
      appRoot: document.getElementById('root'),
      streamSaverMitmUrl: STREAM_SAVER_MITM,
    });
    makeAutoObservable<BugReporterDemoStore, 'reporter' | 'activitySeq'>(
      this,
      { reporter: false, activitySeq: false },
      { autoBind: true }
    );
  }

  /** Throws from the click handler on purpose: an uncaught error is the first thing a report must carry. */
  submitTransfer(): void {
    this.record('transfer');
    const payload: { readonly beneficiary?: { readonly iban: string } } = {};
    // oxlint-disable-next-line no-console -- the demo deliberately writes to the console the reporter collects
    console.error('Transfer rejected: missing beneficiary', payload);
    throw new TypeError(`Cannot read properties of undefined (reading 'iban')`);
  }

  recalculatePortfolio(): void {
    this.record('recalculate');
    const until = performance.now() + BUSY_WORK_MS;
    let checksum = 0;
    while (performance.now() < until) {
      checksum = (checksum + Math.sqrt(checksum + 1)) % CHECKSUM_MODULO;
    }
    // oxlint-disable-next-line no-console -- the demo deliberately writes to the console the reporter collects
    console.info('Portfolio recalculated', { checksum, tookMs: BUSY_WORK_MS });
  }

  async refreshQuotes(): Promise<void> {
    this.record('quotes');
    this.quotesPending = true;
    try {
      await fetch(QUOTES_ENDPOINT);
    } catch (error) {
      // oxlint-disable-next-line no-console -- the demo deliberately writes to the console the reporter collects
      console.warn('Quotes refresh failed', error);
    } finally {
      runInAction(() => {
        this.quotesPending = false;
      });
    }
  }

  shuffleWidgets(): void {
    this.record('shuffle');
    const [first, ...rest] = this.panels;
    this.panels = first === undefined ? this.panels : [...rest, first];
  }

  floodConsole(): void {
    this.record('console');
    for (let line = 1; line <= CONSOLE_FLOOD_LINES; line += 1) {
      // oxlint-disable-next-line no-console -- the demo deliberately writes to the console the reporter collects
      console.log('tick', line, {
        queue: line % FLOOD_QUEUES,
        lag: `${line * FLOOD_LAG_STEP_MS}ms`,
      });
    }
    // oxlint-disable-next-line no-console -- the demo deliberately writes to the console the reporter collects
    console.debug('flood finished', new Map([['lines', CONSOLE_FLOOD_LINES]]));
  }

  dispose(): void {
    this.reporter.dispose();
  }

  private record(symptom: TSymptom): void {
    this.activitySeq += 1;
    this.activity = [{ id: this.activitySeq, symptom }, ...this.activity].slice(0, MAX_ACTIVITY);
  }
}
