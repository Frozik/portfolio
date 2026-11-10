import type { IDocumentHistory } from './versioned-document';
import { gapsIn, openDocument, sealDocument } from './versioned-document';

/** A document that grew twice: a name, then a second field, then the name split. */
const HISTORY: IDocumentHistory = {
  version: 3,
  migrations: {
    1: data => ({ ...(data as object), nickname: null }),
    2: data => {
      const { name, ...rest } = data as { readonly name: string };
      const [first, last] = name.split(' ');
      return { ...rest, first, last };
    },
  },
};

describe('a stored document read by its version', () => {
  it('reads one of the current version as it is', () => {
    const data = { first: 'Anna', last: 'Lee', nickname: 'A' };
    expect(openDocument(sealDocument(HISTORY, data), HISTORY)).toEqual({ kind: 'current', data });
  });

  it('carries an older one through every step up to the current version', () => {
    expect(
      openDocument(JSON.stringify({ version: 1, data: { name: 'Anna Lee' } }), HISTORY)
    ).toEqual({ kind: 'migrated', from: 1, data: { first: 'Anna', last: 'Lee', nickname: null } });
  });

  it('cannot read one written without a version', () => {
    expect(openDocument(JSON.stringify({ name: 'Anna Lee' }), HISTORY)).toEqual({
      kind: 'unreadable',
      reason: 'not-versioned',
    });
  });

  it('leaves alone one a newer app wrote, and says which version', () => {
    expect(openDocument(JSON.stringify({ version: 4, data: {} }), HISTORY)).toEqual({
      kind: 'newer',
      version: 4,
    });
  });

  it('cannot read one whose history has a step missing', () => {
    const gappy: IDocumentHistory = { version: 3, migrations: { 2: data => data } };

    expect(openDocument(JSON.stringify({ version: 1, data: {} }), gappy)).toEqual({
      kind: 'unreadable',
      reason: 'no-migration',
    });
  });

  it('cannot read one a step fails on', () => {
    const failing: IDocumentHistory = {
      version: 2,
      migrations: {
        1: () => {
          throw new Error('not the shape the step knows');
        },
      },
    };

    expect(openDocument(JSON.stringify({ version: 1, data: {} }), failing)).toEqual({
      kind: 'unreadable',
      reason: 'migration-failed',
    });
  });

  it('cannot read what is not JSON', () => {
    expect(openDocument('{oops', HISTORY)).toEqual({ kind: 'unreadable', reason: 'not-json' });
  });

  it('finds the gaps in a history, so none ships with one', () => {
    expect(gapsIn(HISTORY)).toEqual([]);
    expect(gapsIn({ version: 1, migrations: {} })).toEqual([]);
    expect(gapsIn({ version: 4, migrations: { 1: data => data, 3: data => data } })).toEqual([2]);
  });
});
