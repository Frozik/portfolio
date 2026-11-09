import { SCENARIO_BOOK } from '../../fixtures/scenario-world';
import { decodeGroupBook, encodeGroupBook } from './group-book-codec';

describe('the stored group book', () => {
  it('reads back exactly what was written', () => {
    const written = encodeGroupBook(SCENARIO_BOOK);
    const read = decodeGroupBook(written);
    expect(read.ok && JSON.parse(encodeGroupBook(read.value))).toEqual(JSON.parse(written));
  });

  it('refuses a broken file instead of half-reading it', () => {
    expect(decodeGroupBook('{"schema":1,"groups":[{"kind":"custom"}]}').ok).toBe(false);
    expect(decodeGroupBook('not json')).toEqual({ ok: false, error: { kind: 'not-json' } });
  });

  it('refuses a document of a newer schema', () => {
    expect(decodeGroupBook('{"schema":2,"groups":[]}').ok).toBe(false);
  });
});
