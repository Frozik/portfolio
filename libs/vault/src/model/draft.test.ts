import { mergeCard } from '../merge/merge-card';
import { aCard, aCardWith, aDocument, aField, anHlc } from '../testing/builders';
import { allFields } from './card';
import { concurrentVersions } from './card-versions';
import { draftConflict, saveDraft } from './draft';
import { setFieldValue } from './field-edits';
import { purgeCard } from './purge-card';
import { cardState, commitCard } from './revision-edits';

const login = aField({ kind: 'login' }, 'jane');
const password = aField({ kind: 'password', rotateEveryDays: null }, 'old-secret', {
  sensitive: true,
});
const original = aCardWith([login, password], { title: 'Bank', updatedAt: anHlc(10) });
const base = cardState(original);
const mineRenamed = { ...base, title: 'Bank (mine)' };

function theirs(change: (card: ReturnType<typeof cardState>) => ReturnType<typeof cardState>) {
  return {
    ...original,
    ...change(base),
    updatedAt: anHlc(15, 'device-b:1'),
    ancestors: [anHlc(10)],
  };
}

describe('saving a draft', () => {
  it('saves a new card with the save stamp as its creation', () => {
    const fresh = cardState(aCard({ title: 'New' }));

    const { document, outcome } = saveDraft(aDocument(), { kind: 'new', card: fresh }, anHlc(20));

    expect(outcome).toBe('saved');
    expect(document.cards.get(fresh.id)).toMatchObject({
      title: 'New',
      createdAt: anHlc(20),
      updatedAt: anHlc(20),
      ancestors: [],
    });
  });

  it('saves over the version it started from, as its child', () => {
    const { document, outcome } = saveDraft(
      aDocument([original]),
      { kind: 'edit', base, card: mineRenamed },
      anHlc(20)
    );

    expect(outcome).toBe('saved');
    expect(document.cards.get(original.id)).toMatchObject({
      title: 'Bank (mine)',
      ancestors: [anHlc(10)],
    });
  });

  it('saves nothing over a version changed elsewhere until the user decides, and shows both sides', () => {
    const changed = theirs(card =>
      setFieldValue(card, password.id, { cardinality: 'single', value: 'their-secret' })
    );
    const draft = { kind: 'edit', base, card: mineRenamed } as const;

    const conflict = draftConflict(aDocument([changed]), draft);
    const unresolved = saveDraft(aDocument([changed]), draft, anHlc(20));

    expect(conflict).toMatchObject({ kind: 'changed-elsewhere', clashes: [] });
    expect(
      conflict.kind === 'changed-elsewhere' && conflict.theirChanges.map(change => change.kind)
    ).toEqual(['field-changed']);
    expect(
      conflict.kind === 'changed-elsewhere' && conflict.myChanges.map(change => change.kind)
    ).toEqual(['title']);
    expect(unresolved.outcome).toBe('needs-resolution');
    expect(unresolved.document.cards.get(original.id)).toBe(changed);
  });

  it('keeps mine, takes theirs, or combines both — always as a child of the fresher version', () => {
    const changed = theirs(card =>
      setFieldValue(card, password.id, { cardinality: 'single', value: 'their-secret' })
    );
    const draft = { kind: 'edit', base, card: mineRenamed } as const;
    const document = aDocument([changed]);

    const kept = saveDraft(document, draft, anHlc(20), { kind: 'keep-mine' });
    const taken = saveDraft(document, draft, anHlc(20), { kind: 'take-theirs' });
    const combined = saveDraft(document, draft, anHlc(20), { kind: 'combine', choices: new Map() });

    expect(kept.document.cards.get(original.id)).toMatchObject({
      title: 'Bank (mine)',
      ancestors: [anHlc(15, 'device-b:1'), anHlc(10)],
    });
    expect(kept.document.cards.get(original.id)?.history[0]?.at).toEqual(anHlc(15, 'device-b:1'));
    expect(taken).toEqual({ document, outcome: 'discarded' });
    const result = combined.document.cards.get(original.id);
    expect(combined.outcome).toBe('combined');
    expect(result?.title).toBe('Bank (mine)');
    expect(result && allFields(result).find(field => field.id === password.id)?.value).toEqual({
      cardinality: 'single',
      value: 'their-secret',
    });
  });

  it('combines from the common ancestor when the draft started on a version that lost a concurrent merge', () => {
    const note = aField({ kind: 'note' }, 'base');
    const v0 = aCardWith([note], { title: 'Bank', updatedAt: anHlc(1) });
    const onA = commitCard(
      v0,
      setFieldValue(v0, note.id, { cardinality: 'single', value: 'note from A' }),
      anHlc(2, 'a:1')
    );
    const onB = commitCard(v0, { ...cardState(v0), title: 'Renamed on B' }, anHlc(3, 'b:1'));
    const merged = mergeCard(onA, onB);
    const draft = {
      kind: 'edit',
      base: cardState(onA),
      card: { ...cardState(onA), favorite: true },
    } as const;
    const document = aDocument([merged]);

    const conflict = draftConflict(document, draft);
    const combined = saveDraft(document, draft, anHlc(9, 'a:1'), {
      kind: 'combine',
      choices: new Map(),
    });

    expect(conflict).toMatchObject({ kind: 'changed-elsewhere', clashes: [] });
    expect(
      conflict.kind === 'changed-elsewhere' && conflict.theirChanges.map(change => change.kind)
    ).toEqual(['title']);
    const result = combined.document.cards.get(v0.id);
    expect(result?.title).toBe('Renamed on B');
    expect(result?.favorite).toBe(true);
    expect(result && allFields(result)[0]?.value).toEqual({
      cardinality: 'single',
      value: 'note from A',
    });
  });

  it.each([
    { kind: 'keep-mine' },
    { kind: 'take-theirs' },
    { kind: 'combine', choices: new Map() },
  ] as const)('leaves no conflict behind once the user chose %o', resolution => {
    const note = aField({ kind: 'note' }, 'base');
    const v0 = aCardWith([note], { title: 'Bank', updatedAt: anHlc(1) });
    const onA = commitCard(v0, { ...cardState(v0), title: 'A' }, anHlc(2, 'a:1'));
    const onB = commitCard(v0, { ...cardState(v0), title: 'B' }, anHlc(3, 'b:1'));
    const document = aDocument([mergeCard(onA, onB)]);
    const draft = {
      kind: 'edit',
      base: cardState(onA),
      card: { ...cardState(onA), title: 'A, edited' },
    } as const;

    const saved = saveDraft(document, draft, anHlc(9, 'a:1'), resolution).document.cards.get(v0.id);

    expect(saved && concurrentVersions(saved)).toEqual([]);
  });

  it('brings back a card deleted elsewhere, from the trash or for good', () => {
    const draft = { kind: 'edit', base, card: { ...base, title: 'Kept' } } as const;
    const trashed = aDocument([{ ...original, trashedAt: anHlc(12) }]);
    const purged = purgeCard(aDocument([original]), original.id, anHlc(12));

    const fromTrash = saveDraft(trashed, draft, anHlc(20));
    const fromPurge = saveDraft(purged, draft, anHlc(20));

    expect(fromTrash.outcome).toBe('restored');
    expect(fromTrash.document.cards.get(original.id)?.trashedAt).toBeNull();
    expect(draftConflict(purged, draft)).toEqual({ kind: 'deleted-elsewhere' });
    expect(fromPurge.outcome).toBe('restored');
    expect(fromPurge.document.cards.get(original.id)).toMatchObject({
      title: 'Kept',
      updatedAt: anHlc(20),
      history: [],
    });
  });
});
