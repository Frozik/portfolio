import { SCENARIO_BOOK } from '../../fixtures/scenario-world';
import { decodeGroupBook, encodeGroupBook } from './group-book-codec';

describe('the stored group book', () => {
  it('reads back exactly what was written', () => {
    const written = encodeGroupBook(SCENARIO_BOOK);
    const read = decodeGroupBook(written);
    expect(read.ok && JSON.parse(encodeGroupBook(read.value.book))).toEqual(JSON.parse(written));
  });

  it('is written under its version', () => {
    expect(JSON.parse(encodeGroupBook(SCENARIO_BOOK))).toMatchObject({ version: 2 });
  });

  it('reads a book written before books carried a version, and says it came from version 0', () => {
    const current = JSON.parse(encodeGroupBook(SCENARIO_BOOK)) as { data: { groups: unknown } };
    const legacy = JSON.stringify({ schema: 1, groups: current.data.groups });

    const read = decodeGroupBook(legacy);

    expect(read.ok && read.value.migratedFrom).toBe(0);
    expect(read.ok && JSON.parse(encodeGroupBook(read.value.book))).toEqual(
      JSON.parse(encodeGroupBook(SCENARIO_BOOK))
    );
  });

  it('reads a book that still kept a scheduled action, now always the opposite of the rest of the time', () => {
    const current = JSON.parse(encodeGroupBook(SCENARIO_BOOK)) as {
      data: { groups: { policy: { scheduled: object | null } }[] };
    };
    const groups = current.data.groups.map(group => ({
      ...group,
      policy: {
        ...group.policy,
        scheduled:
          group.policy.scheduled === null ? null : { ...group.policy.scheduled, action: 'pass' },
      },
    }));

    const read = decodeGroupBook(JSON.stringify({ version: 1, data: { groups } }));

    expect(read.ok && read.value.migratedFrom).toBe(1);
    expect(read.ok && JSON.parse(encodeGroupBook(read.value.book))).toEqual(
      JSON.parse(encodeGroupBook(SCENARIO_BOOK))
    );
  });

  it('leaves alone a book a newer app wrote, and says so', () => {
    expect(decodeGroupBook(JSON.stringify({ version: 3, data: { groups: [] } }))).toEqual({
      ok: false,
      error: { kind: 'newer', version: 3 },
    });
  });

  it('refuses a broken file instead of half-reading it', () => {
    expect(decodeGroupBook('{"schema":1,"groups":[{"kind":"custom"}]}').ok).toBe(false);
    expect(decodeGroupBook('not json')).toEqual({ ok: false, error: { kind: 'not-json' } });
  });

  it('refuses a document of a newer schema', () => {
    expect(decodeGroupBook('{"schema":2,"groups":[]}').ok).toBe(false);
  });

  it('drops a «holidays where I am» calendar rule an older app saved, and keeps the group and its other rules', () => {
    const stored = JSON.parse(encodeGroupBook(SCENARIO_BOOK)) as {
      data: { groups: { id: string; policy: { scheduled: { calendars: unknown[] } | null } }[] };
    };
    const courier = stored.data.groups.find(group => group.id === 'couriers');
    const rules = courier?.policy.scheduled?.calendars ?? [];
    const kept = rules.length;
    rules.push({ ...(rules[0] as object), source: { kind: 'holidays-here' } });

    const read = decodeGroupBook(JSON.stringify(stored));

    const group = read.ok ? read.value.book.groups.find(item => item.id === 'couriers') : undefined;
    expect(group?.policy.scheduled?.calendars.length).toBe(kept);
    expect(group?.policy.scheduled?.calendars.map(rule => rule.source.kind)).not.toContain(
      'holidays-here'
    );
  });
});
