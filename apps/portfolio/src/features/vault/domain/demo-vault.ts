import type { INewAsset } from '@frozik/vault/model/asset-edits';
import { addAsset } from '@frozik/vault/model/asset-edits';
import type { ICardState, IVaultCard, TFieldKind } from '@frozik/vault/model/card';
import { allFields } from '@frozik/vault/model/card';
import type { TTranslate } from '@frozik/vault/model/card-edits';
import {
  addToGroup,
  archiveCard,
  createCard,
  putCard,
  renameCard,
  setFavorite,
  setProtected,
} from '@frozik/vault/model/card-edits';
import { addField, setFieldValue } from '@frozik/vault/model/field-edits';
import { createGroup } from '@frozik/vault/model/group-edits';
import type { IHlc } from '@frozik/vault/model/hlc';
import type { TGroupId } from '@frozik/vault/model/ids';
import { linkCards } from '@frozik/vault/model/link-edits';
import { cardState } from '@frozik/vault/model/revision-edits';
import { BANK_ACCOUNT_TEMPLATE } from '@frozik/vault/model/templates/bank-account';
import { BANK_CARD_TEMPLATE } from '@frozik/vault/model/templates/bank-card';
import { DOCUMENT_TEMPLATE } from '@frozik/vault/model/templates/document';
import { INTERNET_ACCOUNT_TEMPLATE } from '@frozik/vault/model/templates/internet-account';
import { NOTE_TEMPLATE } from '@frozik/vault/model/templates/note';
import { SERVER_TEMPLATE } from '@frozik/vault/model/templates/server';
import type { ICardTemplate } from '@frozik/vault/model/templates/template';
import { WIFI_TEMPLATE } from '@frozik/vault/model/templates/wifi';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

/** The one vault whose password is shown on screen; its data is made up. */
export const DEMO_VAULT_PASSWORD = 'demo';

type TValues = Readonly<Partial<Record<TFieldKind, string | readonly string[]>>>;

const WEAK_PASSWORD = 'password123';
const REUSED_PASSWORD = 'Summer-Holidays-2024';
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const DEMO_PRIVATE_KEY =
  '-----BEGIN OPENSSH PRIVATE KEY-----\nnot a real key: a demonstration\n-----END OPENSSH PRIVATE KEY-----';

function totp(issuer: string, account: string): string {
  return `otpauth://totp/${issuer}:${account}?secret=${TOTP_SECRET}&issuer=${issuer}`;
}

function filled(card: ICardState, values: TValues): ICardState {
  return allFields(card).reduce<ICardState>((current, field) => {
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
  }, card);
}

/**
 * A vault with something of everything: accounts with
 * several sites and one-time codes, a weak and a reused password for the
 * audit, cards that are fine, expiring and expired, linked online banking,
 * EU bank details, a protected and an archived card, groups.
 */
export function withDemoCards(
  document: IVaultDocument,
  {
    translate,
    random,
    at,
    today,
    scan,
  }: {
    readonly translate: TTranslate;
    readonly random: IRandom;
    readonly at: IHlc;
    readonly today: Temporal.PlainDate;
    /** The passport's scan, its hash computed by the caller (hashing is asynchronous). */
    readonly scan: INewAsset;
  }
): IVaultDocument {
  const work = createGroup(document, translate('demo.groupWork'), at, random);
  const family = createGroup(work.document, translate('demo.groupFamily'), at, random);
  const scanned = addAsset(family.document, scan, at, random);
  let result = scanned.document;

  const card = (
    template: ICardTemplate,
    title: string,
    values: TValues,
    edit: (state: ICardState) => ICardState = state => state
  ): IVaultCard => {
    const created = createCard(template, { translate, random }, at);
    const state = edit(filled(renameCard(cardState(created), title), values));
    const stored: IVaultCard = { ...state, history: [] };
    result = putCard(result, stored);
    return stored;
  };
  const inGroup = (groupId: TGroupId) => (state: ICardState) => addToGroup(state, groupId);
  const withOtp =
    (uri: string) =>
    (state: ICardState): ICardState => {
      const [firstTab] = state.tabs;
      const added = addField(
        state,
        firstTab.id,
        { kind: 'otp', label: translate('demo.oneTimeCode'), cardinality: 'single' },
        random
      );
      return setFieldValue(added.card, added.fieldId, { cardinality: 'single', value: uri });
    };

  card(
    INTERNET_ACCOUNT_TEMPLATE,
    'GitHub',
    {
      url: ['https://github.com', 'https://gist.github.com', 'https://docs.github.com'],
      login: 'jane-doe',
      password: 'tundra-velvet-orbit-cactus-lantern',
      email: 'jane.doe@example.com',
    },
    state => setFavorite(inGroup(work.groupId)(withOtp(totp('GitHub', 'jane-doe'))(state)), true)
  );
  card(
    INTERNET_ACCOUNT_TEMPLATE,
    'Dropbox',
    {
      url: ['https://www.dropbox.com'],
      login: 'jane.doe@example.com',
      password: 'K7#mPq2!vRx9wLs4',
    },
    withOtp(totp('Dropbox', 'jane.doe@example.com'))
  );
  card(
    INTERNET_ACCOUNT_TEMPLATE,
    'Netflix',
    { url: ['https://www.netflix.com'], login: 'jane.doe@example.com', password: WEAK_PASSWORD },
    inGroup(family.groupId)
  );
  card(INTERNET_ACCOUNT_TEMPLATE, 'Amazon', {
    url: ['https://www.amazon.com'],
    login: 'jane.doe@example.com',
    password: REUSED_PASSWORD,
  });
  card(INTERNET_ACCOUNT_TEMPLATE, 'Spotify', {
    url: ['https://open.spotify.com'],
    login: 'janedoe',
    password: REUSED_PASSWORD,
  });
  card(
    INTERNET_ACCOUNT_TEMPLATE,
    'LinkedIn',
    {
      url: ['https://www.linkedin.com'],
      login: 'jane.doe@example.com',
      password: 'r3tired-Account!',
    },
    state => archiveCard(inGroup(work.groupId)(state), at)
  );
  card(
    INTERNET_ACCOUNT_TEMPLATE,
    'Steam',
    { url: ['https://store.steampowered.com'], login: 'jane_plays', password: 'Gl4cier!Fox#Run' },
    withOtp(`${totp('Steam', 'jane_plays')}&encoder=steam`)
  );

  const holder = 'JANE DOE';
  const visa = card(
    BANK_CARD_TEMPLATE,
    'Visa Classic',
    {
      'card-number': '4111111111111111',
      text: holder,
      'expiry-month': today.add({ years: 3 }).toPlainYearMonth().toString(),
      cvv: '123',
      pin: '0420',
      phone: '+1 800 555 0100',
    },
    state => setFavorite(state, true)
  );
  const mastercard = card(BANK_CARD_TEMPLATE, 'Mastercard Gold', {
    'card-number': '5555555555554444',
    text: holder,
    'expiry-month': today.toPlainYearMonth().toString(),
    cvv: '456',
    pin: '1357',
  });
  card(BANK_CARD_TEMPLATE, 'American Express', {
    'card-number': '378282246310005',
    text: holder,
    'expiry-month': today.toPlainYearMonth().subtract({ months: 1 }).toString(),
    cvv: '7890',
  });
  const banking = card(INTERNET_ACCOUNT_TEMPLATE, translate('demo.onlineBanking'), {
    url: ['https://bank.example.com'],
    login: 'jdoe-4821',
    password: 'Harbour!Lamp7Quiet',
  });
  for (const linked of [visa, mastercard]) {
    const next = linkCards(result, banking.id, linked.id, at);
    result = next.ok ? next.value : result;
  }

  card(BANK_ACCOUNT_TEMPLATE, translate('demo.savingsAccount'), {
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
  });
  card(
    WIFI_TEMPLATE,
    translate('demo.homeWifi'),
    {
      text: 'Doe-Home',
      password: 'blue-kettle-morning-42',
      select: translate('option.wpa3'),
      boolean: 'false',
    },
    inGroup(family.groupId)
  );
  card(
    DOCUMENT_TEMPLATE,
    translate('demo.passport'),
    {
      secret: 'X1234567',
      text: translate('demo.passportIssuer'),
      date: today.subtract({ years: 4 }).toString(),
      'expiry-date': today.add({ years: 6 }).toString(),
      file: [scanned.assetId],
    },
    state => setProtected(inGroup(family.groupId)(state), true)
  );
  card(
    SERVER_TEMPLATE,
    translate('demo.server'),
    {
      url: ['ssh://build.example.com', 'ssh://10.0.0.12'],
      login: 'deploy',
      password: 'Copper-Field-Echo-88',
      multiline: DEMO_PRIVATE_KEY,
    },
    inGroup(work.groupId)
  );
  card(NOTE_TEMPLATE, translate('demo.note'), { note: translate('demo.noteText') });

  return result;
}
