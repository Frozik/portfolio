/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';

import type { TSqlValue } from '@frozik/utils/sql/sql-driver';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Temporal } from 'temporal-polyfill';

import type { IDiagnosticsEntry } from '@frozik/vault-app/diagnostics/domain/diagnostics-entry';

import { sqliteDiagnosticsJournal } from './sqlite-diagnostics-journal';

type TSyncDatabase = Pick<SQLiteDatabase, 'execSync' | 'runSync' | 'getAllSync' | 'getFirstSync'>;

/** The slice of `expo-sqlite`'s synchronous API the journal calls, answered by the same engine. */
function sqliteLikeExpo(database = new DatabaseSync(':memory:')): TSyncDatabase {
  const fake = {
    execSync: (sql: string) => database.exec(sql),
    runSync: (sql: string, params: TSqlValue[] = []) => {
      const { changes, lastInsertRowid } = database.prepare(sql).run(...params);
      return { changes: Number(changes), lastInsertRowId: Number(lastInsertRowid) };
    },
    getAllSync: (sql: string, params: TSqlValue[] = []) => database.prepare(sql).all(...params),
    getFirstSync: (sql: string, params: TSqlValue[] = []) =>
      database.prepare(sql).get(...params) ?? null,
  };
  return fake as unknown as TSyncDatabase;
}

const anEntry = (atMs: number, event = 'opened'): IDiagnosticsEntry => ({
  at: Temporal.Instant.fromEpochMilliseconds(atMs),
  level: 'info',
  category: 'unlock',
  event,
  fields: { access: 'read-write' },
});

describe('the diagnostics log on the phone', () => {
  it('gives the entries back newest first, as they were written', () => {
    const journal = sqliteDiagnosticsJournal(() => sqliteLikeExpo());

    journal.append(anEntry(1_000, 'first'));
    journal.append(anEntry(2_000, 'second'));

    expect(journal.latest(10)).toEqual([anEntry(2_000, 'second'), anEntry(1_000, 'first')]);
  });

  it('drops what is older than asked, and keeps its term across restarts', () => {
    const file = new DatabaseSync(':memory:');
    const journal = sqliteDiagnosticsJournal(() => sqliteLikeExpo(file));
    journal.append(anEntry(1_000, 'old'));
    journal.append(anEntry(5_000, 'new'));

    journal.dropBefore(Temporal.Instant.fromEpochMilliseconds(3_000));
    journal.setTerm(30);
    const reopened = sqliteDiagnosticsJournal(() => sqliteLikeExpo(file));

    expect({
      events: reopened.latest(10).map(entry => entry.event),
      term: reopened.term(),
    }).toEqual({
      events: ['new'],
      term: 30,
    });
  });

  it('keeps a week until told otherwise, and skips a row it cannot read', () => {
    const file = new DatabaseSync(':memory:');
    const journal = sqliteDiagnosticsJournal(() => sqliteLikeExpo(file));
    journal.append(anEntry(1_000));
    file.exec(
      "INSERT INTO entries (at, level, category, event, fields) VALUES (2000, 'verbose', 'unlock', 'x', '{}')"
    );

    expect({ term: journal.term(), events: journal.latest(10).length }).toEqual({
      term: 7,
      events: 1,
    });
  });

  it('takes no entry when its file cannot be written, and does not throw at the app', () => {
    const file = new DatabaseSync(':memory:');
    const journal = sqliteDiagnosticsJournal(() => sqliteLikeExpo(file));
    file.close();

    expect(journal.append(anEntry(1_000))).toBe(false);
  });

  it('starts empty, keeping a week, when its file cannot be opened at all', () => {
    const journal = sqliteDiagnosticsJournal(() => {
      throw new Error('disk full');
    });

    expect({
      written: journal.append(anEntry(1_000)),
      entries: journal.latest(10),
      term: journal.term(),
    }).toEqual({ written: false, entries: [], term: 7 });
  });
});
