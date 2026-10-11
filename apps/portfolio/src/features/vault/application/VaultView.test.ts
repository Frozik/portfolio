import { allFields } from '@frozik/vault/model/card';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';
import { aCard, aCardWith, aDocument, aField } from '@frozik/vault/testing/builders';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { observable } from 'mobx';

import { DEMO_SCAN } from '../domain/demo-specimen';
import { withDemoCards } from '../domain/demo-vault';

import { createFakeSessionClock } from './fake-session-clock.test-helper';
import { VaultView } from './VaultView';

const DAY_MS = 24 * 60 * 60 * 1000;

function aView(document: IVaultDocument) {
  const time = createFakeSessionClock();
  const box = observable.box(document, { deep: false });
  return { view: new VaultView(() => box.get(), time.clock), box, time };
}

const titles = (cards: readonly { readonly title: string }[]): readonly string[] =>
  cards.map(card => card.title);

describe('VaultView', () => {
  it('lists the section the URL chose, favourites first, then by title', () => {
    const { view } = aView(
      aDocument([
        aCard({ title: 'Zoom' }),
        aCard({ title: 'Bank', favorite: true }),
        aCard({ title: 'Amazon' }),
      ])
    );

    expect(titles(view.visibleCards)).toEqual(['Bank', 'Amazon', 'Zoom']);
    view.show('favorites');
    expect(titles(view.visibleCards)).toEqual(['Bank']);
  });

  it('narrows the list as the query is typed, best match first', () => {
    const { view } = aView(
      aDocument([
        aCard({ title: 'My github mirror' }),
        aCard({ title: 'GitHub' }),
        aCard({ title: 'Bank' }),
      ])
    );

    view.setQuery('git');

    expect(titles(view.visibleCards)).toEqual(['GitHub', 'My github mirror']);
  });

  it('counts each section and follows edits to the document', () => {
    const { view, box } = aView(aDocument([aCard({ title: 'One' })]));

    expect(view.countOf('all')).toBe(1);
    box.set(aDocument([aCard({ title: 'One' }), aCard({ title: 'Two', favorite: true })]));

    expect(view.countOf('all')).toBe(2);
    expect(view.countOf('favorites')).toBe(1);
  });

  it('moves a card into "expired" when the day passes, with no edit', () => {
    const time = createFakeSessionClock();
    const today = time.clock.today();
    const passport = aCardWith([aField({ kind: 'expiry-date' }, today.toString())], {
      title: 'Passport',
    });
    const view = new VaultView(() => aDocument([passport]), time.clock);

    expect(view.countOf('expired')).toBe(0);
    time.advance(DAY_MS);

    expect(view.today.equals(today.add({ days: 1 }))).toBe(true);
    expect(view.countOf('expired')).toBe(1);
  });

  it('finds nothing by a password or any other secret value', () => {
    const time = createFakeSessionClock();
    const demo = withDemoCards(
      emptyVaultDocument('Demo', { wallMs: 1, counter: 0, node: 'demo' }),
      {
        translate: key => key,
        random: createSeededRandom(1),
        at: { wallMs: 1, counter: 0, node: 'demo' },
        today: time.clock.today(),
        scan: { ...DEMO_SCAN, sha256: 'hash' },
      }
    );
    const view = new VaultView(() => demo, time.clock);
    const secrets = [...demo.cards.values()].flatMap(card =>
      allFields(card)
        .filter(field => field.sensitive && field.value.cardinality === 'single')
        .map(field => (field.value.cardinality === 'single' ? field.value.value : ''))
        .filter(value => value.length >= 6)
    );

    expect(secrets.length).toBeGreaterThan(5);
    for (const secret of secrets) {
      view.setQuery(secret);
      expect(view.visibleCards).toEqual([]);
    }
  });
});
