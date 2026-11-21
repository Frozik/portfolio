import { SCENARIO_BOOK } from '../../fixtures/scenario-world';
import { decodeGroupBook, encodeGroupBook } from './group-book-codec';

describe('the stored group book', () => {
  it('reads back exactly what was written', () => {
    const written = encodeGroupBook(SCENARIO_BOOK);
    const read = decodeGroupBook(written);
    expect(read.ok && JSON.parse(encodeGroupBook(read.value.book))).toEqual(JSON.parse(written));
  });

  it('is written under its version', () => {
    expect(JSON.parse(encodeGroupBook(SCENARIO_BOOK))).toMatchObject({ version: 1 });
  });

  it('leaves alone a book a newer app wrote, and says so', () => {
    expect(decodeGroupBook(JSON.stringify({ version: 2, data: { groups: [] } }))).toEqual({
      ok: false,
      error: { kind: 'newer', version: 2 },
    });
  });

  it('refuses a broken file instead of half-reading it', () => {
    expect(
      decodeGroupBook(JSON.stringify({ version: 1, data: { groups: [{ kind: 'custom' }] } })).ok
    ).toBe(false);
    expect(decodeGroupBook('not json')).toEqual({ ok: false, error: { kind: 'not-json' } });
  });

  it('reads a book with a mask over caller names, leaving that mask out', () => {
    const written = JSON.parse(encodeGroupBook(SCENARIO_BOOK));
    const custom = written.data.groups.find((group: { kind: string }) => group.kind === 'custom');
    custom.include.push({
      kind: 'name-mask',
      source: '*kol-tsentr*',
      field: 'network',
      note: '',
      id: 'name-1',
      updatedAt: '2026-11-01T00:00:00Z',
      excludedFor: null,
    });
    const read = decodeGroupBook(JSON.stringify(written));
    expect(read.ok && JSON.parse(encodeGroupBook(read.value.book))).toEqual(
      JSON.parse(encodeGroupBook(SCENARIO_BOOK))
    );
  });

  it('refuses a book written without a version', () => {
    expect(decodeGroupBook('{"groups":[]}').ok).toBe(false);
  });
});
