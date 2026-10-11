import { assert } from '@frozik/utils/assert/assert';

import { aCardWith, aField, anHlc } from '../testing/builders';
import type { IVaultCard } from './card';
import { MAX_CARD_HISTORY } from './card';
import { renameCard, setProtected } from './card-edits';
import { setFieldValue } from './field-edits';
import type { TFieldId } from './ids';
import { commitCard, HISTORY_THROTTLE_MS, restoreRevision } from './revision-edits';

const MINUTE = 60_000;

function cardWithPassword(): IVaultCard {
  return aCardWith(
    [
      aField({ kind: 'password', rotateEveryDays: null }, 'old-secret', { sensitive: true }),
      aField({ kind: 'note' }, 'note'),
    ],
    {
      updatedAt: anHlc(1000),
      createdAt: anHlc(1000),
    }
  );
}

function passwordFieldId(card: IVaultCard): TFieldId {
  const [password] = card.tabs[0].fields;
  assert(password !== undefined);
  return password.id;
}

describe('card history', () => {
  it('keeps the previous version at once when a secret changes', () => {
    const card = cardWithPassword();
    const passwordId = passwordFieldId(card);

    const first = commitCard(
      card,
      setFieldValue(card, passwordId, { cardinality: 'single', value: 'new' }),
      anHlc(2000)
    );
    const second = commitCard(
      first,
      setFieldValue(first, passwordId, { cardinality: 'single', value: 'newer' }),
      anHlc(3000)
    );

    expect(second.history.map(revision => revision.at.wallMs)).toEqual([2000, 1000]);
    expect(second.history[1]?.snapshot.tabs[0].fields[0]?.value).toEqual({
      cardinality: 'single',
      value: 'old-secret',
    });
  });

  it('keeps at most one version per five minutes of ordinary edits', () => {
    const card = cardWithPassword();
    const renamed = commitCard(card, renameCard(card, 'A'), anHlc(1000 + MINUTE));
    const renamedAgain = commitCard(renamed, renameCard(renamed, 'B'), anHlc(1000 + 2 * MINUTE));
    const later = commitCard(
      renamedAgain,
      renameCard(renamedAgain, 'C'),
      anHlc(1000 + MINUTE + HISTORY_THROTTLE_MS)
    );

    expect(renamed.history).toHaveLength(1);
    expect(renamedAgain.history).toHaveLength(1);
    expect(later.history.map(revision => revision.snapshot.title)).toEqual(['B', 'Card']);
  });

  it('keeps the newest twenty versions only', () => {
    let card = cardWithPassword();
    for (let edit = 1; edit <= MAX_CARD_HISTORY + 5; edit += 1) {
      card = commitCard(
        card,
        renameCard(card, `Title ${edit}`),
        anHlc(1000 + edit * HISTORY_THROTTLE_MS)
      );
    }

    expect(card.history).toHaveLength(MAX_CARD_HISTORY);
    expect(card.history[0]?.snapshot.title).toBe(`Title ${MAX_CARD_HISTORY + 4}`);
  });

  it('restores a version as a new edit, the current one going to history', () => {
    const card = cardWithPassword();
    const renamed = commitCard(
      card,
      renameCard(card, 'Renamed'),
      anHlc(1000 + HISTORY_THROTTLE_MS)
    );

    const restored = restoreRevision(renamed, anHlc(1000), anHlc(5_000_000));

    expect(restored.title).toBe('Card');
    expect(restored.updatedAt).toEqual(anHlc(5_000_000));
    expect(restored.history.map(revision => revision.snapshot.title)).toEqual(['Renamed', 'Card']);
  });

  it('keeps the card protected when an earlier, unprotected version comes back', () => {
    const card = cardWithPassword();
    const guarded = commitCard(card, setProtected(card, true), anHlc(1000 + HISTORY_THROTTLE_MS));

    const restored = restoreRevision(guarded, anHlc(1000), anHlc(5_000_000));

    expect(restored.protected).toBe(true);
  });
});
