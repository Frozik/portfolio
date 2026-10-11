import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { TBytes } from '../crypto/bytes';
import type { ICardState, IVaultCard, TFieldKind } from '../model/card';
import { allFields } from '../model/card';
import { addToGroup, createCard, editCard, putCard, renameCard } from '../model/card-edits';
import { setFieldValue } from '../model/field-edits';
import { createGroup } from '../model/group-edits';
import type { IHlc } from '../model/hlc';
import type { TAssetId } from '../model/ids';
import { newAssetId } from '../model/ids';
import { linkCards } from '../model/link-edits';
import { purgeCard } from '../model/purge-card';
import { cardState } from '../model/revision-edits';
import { BANK_ACCOUNT_TEMPLATE } from '../model/templates/bank-account';
import { BANK_ACCOUNT_US_TEMPLATE } from '../model/templates/bank-account-us';
import { BANK_CARD_TEMPLATE } from '../model/templates/bank-card';
import { DOCUMENT_TEMPLATE } from '../model/templates/document';
import { INTERNET_ACCOUNT_TEMPLATE } from '../model/templates/internet-account';
import type { ICardTemplate } from '../model/templates/template';
import type { IVaultDocument } from '../model/vault-document';
import { emptyVaultDocument } from '../model/vault-document';
import type { IRandom } from '../ports/random';

const NODE = 'sample-device:1';
const LABELS: Readonly<Record<string, string>> = {};
const translate = (key: string): string => LABELS[key] ?? key.replace(/^\w+\./, '');

function at(wallMs: number): IHlc {
  return { wallMs, counter: 0, node: NODE };
}

function fill(
  card: IVaultCard,
  values: Readonly<Partial<Record<TFieldKind, string | readonly string[]>>>
): IVaultCard {
  const state = allFields(card).reduce<ICardState>((current, field) => {
    const value = field.spec.kind === 'unknown' ? undefined : values[field.spec.kind];
    if (isNil(value)) {
      return current;
    }
    return setFieldValue(
      current,
      field.id,
      typeof value === 'string'
        ? { cardinality: 'single', value }
        : { cardinality: 'list', values: value }
    );
  }, cardState(card));
  return { ...state, history: card.history };
}

function aCardFrom(
  template: ICardTemplate,
  title: string,
  values: Parameters<typeof fill>[1],
  random: IRandom,
  wallMs: number
): IVaultCard {
  const card = createCard(template, { translate, random }, at(wallMs));
  return fill({ ...card, ...renameCard(card, title) }, values);
}

/** A tiny PNG-shaped blob: what matters is that it round-trips byte for byte, stored uncompressed. */
const SCAN: TBytes = Uint8Array.from({ length: 512 }, (_, index) => (index * 37) % 256);

/**
 * A vault with something of everything the format stores: cards of several
 * templates (EU and US bank details first), a list field, a secret, a
 * one-time code, a file, a group, a link and a tombstone. Tests and the
 * golden fixture share it.
 */
export function sampleVaultDocument(random: IRandom): IVaultDocument {
  const account = aCardFrom(
    INTERNET_ACCOUNT_TEMPLATE,
    'GitHub',
    {
      url: ['github.com', 'gist.github.com'],
      login: 'octocat',
      password: 'correct horse battery staple',
      email: 'octocat@example.com',
    },
    random,
    1_760_000_000_000
  );
  const visa = aCardFrom(
    BANK_CARD_TEMPLATE,
    'Visa Platinum',
    {
      'card-number': '4111 1111 1111 1111',
      text: 'JANE DOE',
      'expiry-month': '12/29',
      cvv: '123',
      pin: '0420',
      phone: '+1 (800) 847-2911',
    },
    random,
    1_760_000_001_000
  );
  const euAccount = aCardFrom(
    BANK_ACCOUNT_TEMPLATE,
    'Deutsche Bank',
    { iban: 'DE89 3704 0044 0532 0130 00', bic: 'DEUTDEFF' },
    random,
    1_760_000_002_000
  );
  const usAccount = aCardFrom(
    BANK_ACCOUNT_US_TEMPLATE,
    'Chase Checking',
    { 'bank-code': '021000021', 'bank-account': '000123456789' },
    random,
    1_760_000_003_000
  );
  const passport = aCardFrom(
    DOCUMENT_TEMPLATE,
    'Passport',
    { secret: 'X1234567', 'expiry-date': '2031-05-17' },
    random,
    1_760_000_004_000
  );
  const doomed = aCardFrom(
    INTERNET_ACCOUNT_TEMPLATE,
    'Old forum',
    { url: ['forum.example'] },
    random,
    1_760_000_005_000
  );
  const scanId: TAssetId = newAssetId(random);
  const passportWithScan = fill(passport, { file: [scanId] });

  let document: IVaultDocument = emptyVaultDocument('Sample vault', at(1_760_000_000_000));
  for (const card of [account, visa, euAccount, usAccount, passportWithScan, doomed]) {
    document = putCard(document, card);
  }
  const { document: grouped, groupId } = createGroup(
    document,
    'Finance',
    at(1_760_000_006_000),
    random
  );
  document = [visa, euAccount, usAccount].reduce(
    (current, card) =>
      editCard(current, card.id, at(1_760_000_007_000), state => addToGroup(state, groupId)),
    grouped
  );
  const linked = linkCards(document, visa.id, usAccount.id, at(1_760_000_008_000));
  assert(linked.ok);
  document = purgeCard(linked.value, doomed.id, at(1_760_000_009_000));
  return {
    ...document,
    assets: new Map([
      [
        scanId,
        {
          id: scanId,
          name: 'passport.png',
          mime: 'image/png',
          sha256: 'not-checked-by-the-format',
          storage: { kind: 'inline' },
          orphanedAt: null,
          createdAt: at(1_760_000_004_000),
        },
      ],
    ]),
    assetBytes: new Map([[scanId, SCAN]]),
  };
}
