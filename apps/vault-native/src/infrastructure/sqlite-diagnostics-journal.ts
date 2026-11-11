import type { SQLiteDatabase } from 'expo-sqlite';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type {
  IDiagnosticsEntry,
  TDiagnosticsLevel,
} from '@frozik/vault-app/diagnostics/domain/diagnostics-entry';
import { DIAGNOSTICS_CATEGORIES } from '@frozik/vault-app/diagnostics/domain/diagnostics-entry';
import {
  DEFAULT_DIAGNOSTICS_TERM,
  diagnosticsTermOf,
} from '@frozik/vault-app/diagnostics/domain/diagnostics-terms';
import type { IDiagnosticsJournal } from '@frozik/vault-app/diagnostics/domain/ports/diagnostics-journal';

/** Whatever the term, the log stays this small: a loop of failures cannot fill the phone. */
const KEPT_AT_MOST = 5_000;
const LEVELS: readonly TDiagnosticsLevel[] = ['info', 'warn', 'error'];

interface IEntryRow {
  readonly at: number;
  readonly level: string;
  readonly category: string;
  readonly event: string;
  readonly fields: string;
}

function fieldsOf(json: string): Readonly<Record<string, string>> | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || isNil(parsed)) {
      return null;
    }
    const entries = Object.entries(parsed);
    return entries.every(([, value]) => typeof value === 'string')
      ? Object.fromEntries(entries)
      : null;
  } catch {
    return null;
  }
}

/** A row another build wrote in a shape this one does not know is skipped: it is a log. */
function entryOf(row: IEntryRow): IDiagnosticsEntry | null {
  const level = LEVELS.find(known => known === row.level);
  const category = DIAGNOSTICS_CATEGORIES.find(known => known === row.category);
  const fields = fieldsOf(row.fields);
  if (isNil(level) || isNil(category) || isNil(fields)) {
    return null;
  }
  return {
    at: Temporal.Instant.fromEpochMilliseconds(row.at),
    level,
    category,
    event: row.event,
    fields,
  };
}

function guarded<T>(fallback: T, run: () => T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    event TEXT NOT NULL,
    fields TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS entries_at ON entries (at);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

type TJournalDatabase = Pick<
  SQLiteDatabase,
  'execSync' | 'runSync' | 'getAllSync' | 'getFirstSync'
>;

/**
 * The diagnostics log in a database file of its own, apart from the vaults: losing it loses
 * nothing, so a file that cannot be opened or written leaves the app running with an empty log.
 */
export function sqliteDiagnosticsJournal(open: () => TJournalDatabase): IDiagnosticsJournal {
  const database = guarded<TJournalDatabase | null>(null, () => {
    const opened = open();
    opened.execSync(SCHEMA);
    return opened;
  });
  const using = <T>(fallback: T, run: (ready: TJournalDatabase) => T): T =>
    isNil(database) ? fallback : guarded(fallback, () => run(database));
  return {
    append: entry =>
      using(false, ready => {
        const { lastInsertRowId } = ready.runSync(
          'INSERT INTO entries (at, level, category, event, fields) VALUES (?, ?, ?, ?, ?)',
          [
            entry.at.epochMilliseconds,
            entry.level,
            entry.category,
            entry.event,
            JSON.stringify(entry.fields),
          ]
        );
        ready.runSync('DELETE FROM entries WHERE id <= ?', [lastInsertRowId - KEPT_AT_MOST]);
        return true;
      }),
    latest: limit =>
      using([], ready =>
        ready
          .getAllSync<IEntryRow>(
            'SELECT at, level, category, event, fields FROM entries ORDER BY id DESC LIMIT ?',
            [limit]
          )
          .map(entryOf)
          .filter(entry => entry !== null)
      ),
    dropBefore: at =>
      using(false, ready => {
        ready.runSync('DELETE FROM entries WHERE at < ?', [at.epochMilliseconds]);
        return true;
      }),
    term: () =>
      using(DEFAULT_DIAGNOSTICS_TERM, ready => {
        const row = ready.getFirstSync<{ readonly value: string }>(
          "SELECT value FROM settings WHERE key = 'term'"
        );
        return (
          (isNil(row) ? null : diagnosticsTermOf(Number(row.value))) ?? DEFAULT_DIAGNOSTICS_TERM
        );
      }),
    setTerm: term =>
      using(false, ready => {
        ready.runSync("INSERT OR REPLACE INTO settings (key, value) VALUES ('term', ?)", [
          String(term),
        ]);
        return true;
      }),
  };
}
