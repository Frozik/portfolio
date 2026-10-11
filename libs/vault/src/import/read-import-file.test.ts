import { isNil } from 'lodash-es';

import { utf8 } from '../crypto/bytes';
import type { IVaultCard } from '../model/card';
import { allFields } from '../model/card';
import { emptyVaultDocument } from '../model/vault-document';
import type { IVaultDocument } from '../model/vault-document';
import { anHlc } from '../testing/builders';
import {
  BITWARDEN_CSV,
  BITWARDEN_ENCRYPTED_JSON,
  BITWARDEN_JSON,
  CHROME_CSV,
  FIREFOX_CSV,
  SAFARI_CSV,
  SAFEINCLOUD_XML,
} from '../testing/import-fixtures';
import { createSeededRandom } from '../testing/seeded-random';
import { applyImport } from './apply-import';
import type { IImportBatch } from './imported-card';
import { readImportFile } from './read-import-file';

const AT = anHlc(1_800_000_000_000);

function batchOf(text: string): IImportBatch {
  const read = readImportFile(utf8(text));
  if (!read.ok || read.value.kind !== 'entries') {
    throw new Error(`not an import: ${JSON.stringify(read)}`);
  }
  return read.value.batch;
}

function imported(text: string): IVaultDocument {
  return applyImport(
    emptyVaultDocument('Imports', anHlc(1)),
    batchOf(text),
    { translate: key => key, random: createSeededRandom(1), duplicates: 'keep-both' },
    AT
  ).document;
}

function cardTitled(document: IVaultDocument, title: string): IVaultCard {
  const card = [...document.cards.values()].find(candidate => candidate.title === title);
  if (isNil(card)) {
    throw new Error(`no card ${title}`);
  }
  return card;
}

/** The card's non-empty values by label, the first field of a label winning; a list as a list. */
function valuesOf(card: IVaultCard): Record<string, string | readonly string[]> {
  const values: Record<string, string | readonly string[]> = {};
  for (const { label, value } of allFields(card)) {
    const shown = value.cardinality === 'single' ? value.value : value.values;
    if (shown.length > 0 && !(label in values)) {
      values[label] = shown;
    }
  }
  return values;
}

function groupNamesOf(document: IVaultDocument, card: IVaultCard): readonly string[] {
  return card.groupIds.map(id => document.groups.get(id)?.name ?? id);
}

describe('reading an export', () => {
  it('takes Chrome and Edge passwords with quoted commas, quotes and line breaks', () => {
    const batch = batchOf(CHROME_CSV);
    const document = imported(CHROME_CSV);

    expect(batch.source).toBe('chrome');
    expect(batch.warnings).toEqual([{ kind: 'row-skipped', row: 4 }]);
    expect(valuesOf(cardTitled(document, 'Bank, personal'))).toEqual({
      'field.websites': ['https://online.examplebank.eu/'],
      'field.login': 'jane',
      'field.password': 'pass,with"quote',
      'field.notes': 'first line\nsecond line',
    });
    expect(cardTitled(document, 'github.com').templateId).toBe('internet-account');
  });

  it('names a Firefox login after its site and keeps when it was made', () => {
    const document = imported(FIREFOX_CSV);
    const card = cardTitled(document, 'accounts.example.org');

    expect(valuesOf(card)).toEqual({
      'field.websites': ['https://accounts.example.org'],
      'field.login': 'jane@example.org',
      'field.password': 's3cret-firefox',
    });
    expect(card.createdAt.wallMs).toBe(1_700_000_000_000);
  });

  it('brings the one-time code of a Safari password along', () => {
    const card = cardTitled(imported(SAFARI_CSV), 'example.com (jane)');

    expect(valuesOf(card)).toMatchObject({
      'field.notes': 'Safari note',
      'field.oneTimeCode': expect.stringMatching(/^otpauth:\/\/totp\/.*secret=JBSWY3DPEHPK3PXP/),
    });
  });

  it('maps every Bitwarden item kind onto a template, folders onto groups', () => {
    const document = imported(BITWARDEN_JSON);
    const login = cardTitled(document, 'Example login');

    expect(document.cards.size).toBe(5);
    expect(groupNamesOf(document, login)).toEqual(['Work']);
    expect(login).toMatchObject({ favorite: true, protected: true });
    expect(valuesOf(login)).toMatchObject({
      'field.websites': ['https://login.example.com'],
      'field.login': 'jane',
      'Recovery email': 'backup@example.com',
      'Security answer': 'blue',
      'Has 2FA': 'true',
    });
    expect(cardTitled(document, 'Travel card').templateId).toBe('bank-card');
    expect(valuesOf(cardTitled(document, 'Travel card'))).toMatchObject({
      'field.cardNumber': '4111111111111111',
      'field.validThru': '2029-07',
    });
    expect(valuesOf(cardTitled(document, 'Passport'))).toMatchObject({
      'field.documentNumber': 'X1234567',
      'field.fullName': 'Ms Jane Doe',
      'field.address': '1 Example Street\n10115 Berlin\nDE',
    });
    expect(cardTitled(document, 'Build server key').templateId).toBe('server');
    expect(isNil(cardTitled(document, 'Wi-Fi at the cottage').archivedAt)).toBe(false);
  });

  it('keeps Bitwarden URI matching rules, one field per rule', () => {
    const login = cardTitled(imported(BITWARDEN_JSON), 'Example login');
    const urls = allFields(login).filter(field => field.spec.kind === 'url');

    expect(urls.map(field => field.spec)).toEqual([
      { kind: 'url', match: 'base-domain', useSharedCredentials: true },
      { kind: 'url', match: 'exact', useSharedCredentials: true },
    ]);
  });

  it('turns a bare Bitwarden TOTP secret into a one-time code URI', () => {
    const login = cardTitled(imported(BITWARDEN_JSON), 'Example login');

    expect(valuesOf(login)['field.oneTimeCode']).toMatch(
      /^otpauth:\/\/totp\/.*secret=JBSWY3DPEHPK3PXP/
    );
  });

  it('reports what Bitwarden has and a vault cannot hold', () => {
    expect(batchOf(BITWARDEN_JSON).warnings).toEqual([
      { kind: 'passkey-dropped', card: 'Example login' },
      { kind: 'field-dropped', card: 'Example login', label: 'Linked username' },
      { kind: 'item-skipped', title: 'A kind from the future' },
    ]);
  });

  it('refuses an encrypted Bitwarden export instead of importing nothing', () => {
    expect(readImportFile(utf8(BITWARDEN_ENCRYPTED_JSON))).toEqual({
      ok: false,
      error: 'encrypted-export',
    });
  });

  it('reads Bitwarden CSV: several sites in a cell, custom fields as lines', () => {
    const document = imported(BITWARDEN_CSV);
    const social = cardTitled(document, 'Example social');

    expect(valuesOf(social)).toMatchObject({
      'field.websites': ['https://social.example', 'https://m.social.example'],
      Pet: 'cat',
      City: 'Paris',
    });
    expect(groupNamesOf(document, social)).toEqual(['Social']);
    expect(cardTitled(document, 'Locker code')).toMatchObject({
      templateId: 'note',
      protected: true,
    });
  });

  it('takes SafeInCloud cards with their fields in order and under their own names', () => {
    const document = imported(SAFEINCLOUD_XML);
    const mail = cardTitled(document, 'Example mail');

    expect(document.cards.size).toBe(2);
    expect(allFields(mail).map(field => [field.label, field.spec.kind])).toEqual([
      ['Login', 'login'],
      ['Password', 'password'],
      ['Website', 'url'],
      ['One-time password', 'otp'],
      ['Security answer', 'secret'],
      ['field.notes', 'note'],
    ]);
    expect(valuesOf(mail)).toMatchObject({
      Password: ' 0042 & spaces ',
      Website: ['https://mail.example.com'],
      'field.notes': 'Recovery:\ncall support',
    });
    expect(mail).toMatchObject({ templateId: 'internet-account', favorite: true, color: 'blue' });
    expect(groupNamesOf(document, mail)).toEqual(['Business', 'Shopping']);
    expect(cardTitled(document, 'Travel card')).toMatchObject({
      templateId: 'bank-card',
      color: 'violet',
    });
    expect(valuesOf(cardTitled(document, 'Travel card'))).toMatchObject({ Expiry: '2029-07' });
  });

  it('leaves SafeInCloud templates and deleted cards behind and reports attachments', () => {
    const batch = batchOf(SAFEINCLOUD_XML);

    expect(batch.source).toBe('safeincloud');
    expect(batch.cards.map(card => card.title)).toEqual(['Example mail', 'Travel card']);
    expect(batch.warnings).toEqual([
      { kind: 'file-dropped', card: 'Example mail', name: 'recovery-codes.txt' },
    ]);
  });

  it('reads SafeInCloud names that collide with built-in object properties as plain values', () => {
    const xml = `<database><card title="Odd" color="constructor"><field name="X" type="toString">v</field></card></database>`;
    const [card] = imported(xml).cards.values();

    expect(card?.color).toBeNull();
    expect(isNil(card) ? [] : allFields(card).map(field => field.spec.kind)).toEqual(['text']);
  });

  it('tells a vault file by its magic and asks for its password', () => {
    const file = new Uint8Array([...utf8('PWVAULT\0'), 1, 0, 0, 0]);

    expect(readImportFile(file)).toEqual({
      ok: true,
      value: { kind: 'vault-file', vault: file, sealedBlobs: new Map() },
    });
  });

  it('says so when the file is none of the known exports', () => {
    expect(readImportFile(utf8('a,b\n1,2\n'))).toEqual({ ok: false, error: 'unrecognized' });
    expect(readImportFile(utf8('<html><body/></html>'))).toEqual({
      ok: false,
      error: 'unrecognized',
    });
    expect(readImportFile(new Uint8Array([0xff, 0xfe, 0x00]))).toEqual({
      ok: false,
      error: 'unrecognized',
    });
  });
});
