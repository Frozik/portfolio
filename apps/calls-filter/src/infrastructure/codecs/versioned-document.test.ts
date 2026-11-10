import type { IDocumentHistory } from './versioned-document';
import { gapsIn, openDocument, sealDocument } from './versioned-document';

/** A document that grew twice: a bare name, then wrapped, then given a second field. */
const HISTORY: IDocumentHistory = {
  version: 2,
  migrations: {
    0: data => ({ name: data }),
    1: data => ({ ...(data as object), nickname: null }),
  },
};

describe('a stored document read by its version', () => {
  it('reads one of the current version as it is', () => {
    expect(openDocument(sealDocument(HISTORY, { name: 'Anna', nickname: 'A' }), HISTORY)).toEqual({
      kind: 'current',
      data: { name: 'Anna', nickname: 'A' },
    });
  });

  it('carries an older one through every step up to the current version', () => {
    expect(openDocument(JSON.stringify({ version: 1, data: { name: 'Anna' } }), HISTORY)).toEqual({
      kind: 'migrated',
      from: 1,
      data: { name: 'Anna', nickname: null },
    });
  });

  it('takes a document written before documents carried a version as version 0', () => {
    expect(openDocument(JSON.stringify('Anna'), HISTORY)).toEqual({
      kind: 'migrated',
      from: 0,
      data: { name: 'Anna', nickname: null },
    });
  });

  it('leaves alone one a newer app wrote, and says which version', () => {
    expect(openDocument(JSON.stringify({ version: 3, data: {} }), HISTORY)).toEqual({
      kind: 'newer',
      version: 3,
    });
  });

  it('cannot read one whose history has a step missing', () => {
    const gappy: IDocumentHistory = { version: 2, migrations: { 1: data => data } };

    expect(openDocument(JSON.stringify('Anna'), gappy)).toEqual({
      kind: 'unreadable',
      reason: 'no-migration',
    });
  });

  it('cannot read one a step fails on', () => {
    const failing: IDocumentHistory = {
      version: 1,
      migrations: {
        0: () => {
          throw new Error('not the shape the step knows');
        },
      },
    };

    expect(openDocument(JSON.stringify('Anna'), failing)).toEqual({
      kind: 'unreadable',
      reason: 'migration-failed',
    });
  });

  it('cannot read what is not JSON', () => {
    expect(openDocument('{oops', HISTORY)).toEqual({ kind: 'unreadable', reason: 'not-json' });
  });

  it('finds the gaps in a history, so none ships with one', () => {
    expect(gapsIn(HISTORY)).toEqual([]);
    expect(gapsIn({ version: 3, migrations: { 0: data => data, 2: data => data } })).toEqual([1]);
  });
});
