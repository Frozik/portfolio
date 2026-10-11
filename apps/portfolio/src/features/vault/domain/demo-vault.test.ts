import { fileAssetIdsOf } from '@frozik/vault/model/asset-edits';
import { allFields } from '@frozik/vault/model/card';
import { expiryStatus } from '@frozik/vault/model/expiry';
import { FIELD_KINDS } from '@frozik/vault/model/field-kinds/registry';
import { linkedCardIds } from '@frozik/vault/model/link-edits';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { Temporal } from 'temporal-polyfill';

import { DEMO_SCAN } from './demo-specimen';
import { withDemoCards } from './demo-vault';

const TODAY = Temporal.PlainDate.from('2026-10-11');
const AT = { wallMs: 1, counter: 0, node: 'demo' };

function demo() {
  return withDemoCards(emptyVaultDocument('Demo', AT), {
    translate: key => key,
    random: createSeededRandom(1),
    at: AT,
    today: TODAY,
    scan: { ...DEMO_SCAN, sha256: 'hash' },
  });
}

function cardTitled(title: string) {
  const card = [...demo().cards.values()].find(candidate => candidate.title === title);
  if (card === undefined) {
    throw new Error(`no demo card "${title}"`);
  }
  return card;
}

describe('demo vault', () => {
  it('holds only values its field kinds accept', () => {
    const document = demo();
    const rejected = [...document.cards.values()].flatMap(card =>
      allFields(card).flatMap(field => {
        const values =
          field.value.cardinality === 'single' ? [field.value.value] : field.value.values;
        return values
          .filter(value => value !== '')
          .filter(
            value =>
              FIELD_KINDS[field.spec.kind === 'unknown' ? 'text' : field.spec.kind].validate(
                value,
                { spec: field.spec, card }
              ).kind === 'invalid'
          )
          .map(value => `${card.title} / ${field.label}: ${value}`);
      })
    );

    expect(rejected).toEqual([]);
  });

  it('has a card that is fine, one about to expire and one expired, whatever day it is opened', () => {
    expect(expiryStatus(cardTitled('Visa Classic'), TODAY, 30)).toBe('ok');
    expect(expiryStatus(cardTitled('Mastercard Gold'), TODAY, 30)).toBe('soon');
    expect(expiryStatus(cardTitled('American Express'), TODAY, 30)).toBe('expired');
  });

  it('links online banking to two cards and keeps one card protected and one archived', () => {
    const document = demo();
    const banking = cardTitled('demo.onlineBanking');

    expect(linkedCardIds(document, banking.id)).toHaveLength(2);
    expect([...document.cards.values()].filter(card => card.protected)).toHaveLength(1);
    expect([...document.cards.values()].filter(card => card.archivedAt !== null)).toHaveLength(1);
    expect(document.groups.size).toBe(2);
  });

  it('gives the passport a scan to show', () => {
    const document = demo();
    const passport = cardTitled('demo.passport');
    const scans = allFields(passport).flatMap(field => fileAssetIdsOf(field));

    expect(scans.map(id => document.assets.get(id)?.mime)).toEqual(['image/svg+xml']);
  });
});
