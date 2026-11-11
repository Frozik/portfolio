import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { Milliseconds } from '@frozik/utils/date/types';
import { templateTextsRu } from '@frozik/vault-app/texts/document/template-texts-ru';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import { HASH_WASM_KDF } from '@frozik/vault/crypto/adapters/kdf-hash-wasm';
import { ARGON2_FLOOR } from '@frozik/vault/crypto/kdf-port';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import { WEB_RANDOM } from '@frozik/vault/crypto/web-random';
import { CURRENT_SCHEMA_VERSION } from '@frozik/vault/format/manifest';
import { createVaultKeys } from '@frozik/vault/format/vault-keys';
import type { ICardState, IVaultCard, TCardColor } from '@frozik/vault/model/card';
import { allFields } from '@frozik/vault/model/card';
import { addToGroup, createCard, putCard } from '@frozik/vault/model/card-edits';
import { addField, setFieldValue } from '@frozik/vault/model/field-edits';
import { createGroup, updateGroup } from '@frozik/vault/model/group-edits';
import type { IHlc } from '@frozik/vault/model/hlc';
import type { TGroupId } from '@frozik/vault/model/ids';
import { BANK_ACCOUNT_TEMPLATE } from '@frozik/vault/model/templates/bank-account';
import { BANK_CARD_TEMPLATE } from '@frozik/vault/model/templates/bank-card';
import { DOCUMENT_TEMPLATE } from '@frozik/vault/model/templates/document';
import { EMAIL_ACCOUNT_TEMPLATE } from '@frozik/vault/model/templates/email-account';
import { INTERNET_ACCOUNT_TEMPLATE } from '@frozik/vault/model/templates/internet-account';
import { NOTE_TEMPLATE } from '@frozik/vault/model/templates/note';
import { SERVER_TEMPLATE } from '@frozik/vault/model/templates/server';
import type { ICardTemplate } from '@frozik/vault/model/templates/template';
import { WIFI_TEMPLATE } from '@frozik/vault/model/templates/wifi';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';

/**
 * The vault a developer opens on the emulator after every change: ten cards of eight templates in
 * four groups, with what the audit should find — a weak password, one used twice, one older than a
 * year, a passport about to expire — and a one-time code. Sealed at the lowest Argon2 a reader
 * accepts, so it opens in a moment.
 */
export const TEST_VAULT_PASSWORD = 'test-vault-1234';
export const TEST_VAULT_NAME = 'Тестовая база';

const NODE = 'test-vault';
const DAY_MS = 24 * 60 * 60 * 1000;
const now = Temporal.Now.instant().epochMilliseconds;
const daysAgo = (days: number): IHlc => ({ wallMs: now - days * DAY_MS, counter: 0, node: NODE });
const translate = (key: string): string => templateTextsRu[key] ?? key;

const WEAK = '123456';
const REUSED = 'Summer2024!';
const PASSPORT_EXPIRES_IN_DAYS = 90;

interface ITestCard {
  readonly template: ICardTemplate;
  readonly title: string;
  readonly group: string;
  /** By the template's text key of the field, as `field.login`. */
  readonly values: Readonly<Record<string, string | readonly string[]>>;
  readonly createdDaysAgo?: number;
  readonly favorite?: boolean;
  readonly protected?: boolean;
  readonly otp?: string;
}

const CARDS: readonly ITestCard[] = [
  {
    template: INTERNET_ACCOUNT_TEMPLATE,
    title: 'GitHub',
    group: 'Работа',
    values: {
      'field.websites': ['github.com'],
      'field.login': 'jane-doe',
      'field.password': 'v7#Kq2!mZp9$Lw4x',
      'field.email': 'jane@example.com',
    },
    favorite: true,
    otp: 'otpauth://totp/GitHub:jane-doe?secret=JBSWY3DPEHPK3PXP&issuer=GitHub',
  },
  {
    template: INTERNET_ACCOUNT_TEMPLATE,
    title: 'Slack',
    group: 'Работа',
    values: {
      'field.websites': ['acme.slack.com'],
      'field.login': 'jane@acme.example',
      'field.password': REUSED,
    },
  },
  {
    template: SERVER_TEMPLATE,
    title: 'Прод-сервер',
    group: 'Работа',
    values: {
      'field.hosts': ['prod-1.acme.example', '10.0.0.12'],
      'field.login': 'deploy',
      'field.password': 'r00t-Was-Never-Here-42',
      'field.privateKey':
        '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQ\n-----END OPENSSH PRIVATE KEY-----',
    },
    protected: true,
  },
  {
    template: EMAIL_ACCOUNT_TEMPLATE,
    title: 'Gmail',
    group: 'Личное',
    values: {
      'field.email': 'jane.doe@gmail.com',
      'field.password': REUSED,
      'field.backupCodes': ['4821-9930', '1177-0452', '6610-3384'],
    },
    favorite: true,
  },
  {
    template: DOCUMENT_TEMPLATE,
    title: 'Паспорт',
    group: 'Личное',
    values: {
      'field.documentNumber': 'NX4419027',
      'field.issuedBy': 'Gemeente Amsterdam',
      'field.issuedOn': '2016-04-12',
      'field.expiresOn': Temporal.Now.plainDateISO()
        .add({ days: PASSPORT_EXPIRES_IN_DAYS })
        .toString(),
    },
  },
  {
    template: NOTE_TEMPLATE,
    title: 'Коды восстановления',
    group: 'Личное',
    values: { 'field.notes': 'Apple ID: K7QM-2XPL-9RTD\nTelegram: 31415926' },
    protected: true,
  },
  {
    template: BANK_CARD_TEMPLATE,
    title: 'Visa ING',
    group: 'Финансы',
    values: {
      'field.cardNumber': '4111 1111 1111 1111',
      'field.cardholder': 'JANE DOE',
      'field.validThru': '12/29',
      'field.securityCode': '123',
      'field.pin': '0420',
      'field.lostCardPhone': '+31 20 228 8800',
    },
  },
  {
    template: BANK_ACCOUNT_TEMPLATE,
    title: 'ING Betaalrekening',
    group: 'Финансы',
    values: {
      'field.bank': 'ING',
      'field.accountHolder': 'Jane Doe',
      'field.iban': 'NL91 ABNA 0417 1643 00',
      'field.swift': 'INGBNL2A',
    },
  },
  {
    template: INTERNET_ACCOUNT_TEMPLATE,
    title: 'Netflix',
    group: 'Дом',
    values: {
      'field.websites': ['netflix.com'],
      'field.login': 'family@example.com',
      'field.password': WEAK,
    },
    createdDaysAgo: 500,
  },
  {
    template: WIFI_TEMPLATE,
    title: 'Домашний Wi‑Fi',
    group: 'Дом',
    values: { 'field.ssid': 'Doe-Home-5G', 'field.password': 'correct horse battery staple' },
  },
];

function withOneTimeCode(card: ICardState, uri: string): ICardState {
  const added = addField(
    card,
    card.tabs[0].id,
    { kind: 'otp', label: 'Одноразовый код', cardinality: 'single' },
    WEB_RANDOM
  );
  return setFieldValue(added.card, added.fieldId, { cardinality: 'single', value: uri });
}

function testCard(spec: ITestCard, at: IHlc, groupId: TGroupId): IVaultCard {
  const blank = createCard(spec.template, { translate, random: WEB_RANDOM }, at);
  const filled = Object.entries(spec.values).reduce<ICardState>((card, [key, value]) => {
    const field = allFields(card).find(candidate => candidate.label === translate(key));
    if (isNil(field)) {
      throw new Error(`${spec.template.id} has no field ${key}`);
    }
    return setFieldValue(
      card,
      field.id,
      typeof value === 'string'
        ? { cardinality: 'single', value }
        : { cardinality: 'list', values: value }
    );
  }, blank);
  const state = isNil(spec.otp) ? filled : withOneTimeCode(filled, spec.otp);
  return {
    ...blank,
    ...addToGroup(state, groupId),
    title: spec.title,
    favorite: spec.favorite ?? false,
    protected: spec.protected ?? false,
  };
}

const LABEL_COLORS: Readonly<Record<string, TCardColor | null>> = {
  Работа: 'blue',
  Личное: 'orange',
  Финансы: 'green',
  Дом: null,
};

function testVaultDocument(): IVaultDocument {
  const created = daysAgo(Math.max(...CARDS.map(card => card.createdDaysAgo ?? 1)));
  let document = emptyVaultDocument(TEST_VAULT_NAME, created);
  const groups = new Map<string, TGroupId>();
  for (const name of new Set(CARDS.map(card => card.group))) {
    const made = createGroup(document, name, created, WEB_RANDOM);
    document = updateGroup(made.document, made.groupId, created, {
      color: LABEL_COLORS[name] ?? null,
    });
    groups.set(name, made.groupId);
  }
  return CARDS.reduce((current, spec) => {
    const groupId = groups.get(spec.group);
    if (isNil(groupId)) {
      throw new Error(`no group ${spec.group}`);
    }
    return putCard(current, testCard(spec, daysAgo(spec.createdDaysAgo ?? 1), groupId));
  }, document);
}

export async function sealTestVault(): Promise<Uint8Array> {
  const keys = await createVaultKeys(encodePassword(TEST_VAULT_PASSWORD), ARGON2_FLOOR, {
    argon2: HASH_WASM_KDF,
    random: WEB_RANDOM,
  });
  const codec = createInThreadCodec({
    argon2: HASH_WASM_KDF,
    random: WEB_RANDOM,
    elapsed: () => 0 as Milliseconds,
  });
  const sealed = await codec.seal(
    testVaultDocument(),
    {
      format: 'pwv',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: Temporal.Now.instant().toString(),
      createdBy: 'vault-native test vault',
    },
    { ...keys, revision: 1, movedTo: null },
    new AbortController().signal
  );
  if (!sealed.ok) {
    throw new Error(`the test vault did not seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}
