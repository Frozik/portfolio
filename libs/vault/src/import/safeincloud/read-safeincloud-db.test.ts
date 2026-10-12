import { assert } from '@frozik/utils/assert/assert';

import sampleFile from '../../../fixtures/safeincloud/sample.db?inline';
import { BANK_CARD_TEMPLATE } from '../../model/templates/bank-card';
import { bytesOfDataUrl } from '../../testing/golden-fixtures';
import { SAFEINCLOUD_XML } from '../../testing/import-fixtures';
import { aSafeInCloudDb } from '../../testing/safeincloud-db-fixture';
import { readSafeInCloudDb, startsWithSafeInCloudMagic } from './read-safeincloud-db';

const PASSWORD = 'correct horse';

describe('a SafeInCloud database', () => {
  it('opens a database the macOS app wrote, its templates left behind', async () => {
    const read = await readSafeInCloudDb(bytesOfDataUrl(sampleFile), 'test123');
    assert(read.ok);
    const [habr, visa] = read.value.cards;

    expect(read.value.cards).toHaveLength(2);
    expect(habr?.title).toBe('Habr');
    expect(habr?.tabs[0]?.fields.map(field => [field.spec.kind, field.value])).toEqual([
      ['login', { cardinality: 'single', value: 'habr_login' }],
      ['password', { cardinality: 'single', value: 'habr_password' }],
      ['url', { cardinality: 'list', values: ['http://habr.com'] }],
      ['otp', { cardinality: 'single', value: 'QWASDVAXFHET' }],
    ]);
    expect(visa?.templateId).toBe(BANK_CARD_TEMPLATE.id);
    expect(visa?.tabs[0]?.fields.map(field => field.value)).toContainEqual({
      cardinality: 'single',
      value: '2029-10',
    });
  });

  it('turns down the macOS app’s database with a wrong password', async () => {
    expect(await readSafeInCloudDb(bytesOfDataUrl(sampleFile), 'test124')).toEqual({
      ok: false,
      error: 'wrong-password',
    });
  });

  it('opens with its password into the same cards as its XML export', async () => {
    const read = await readSafeInCloudDb(await aSafeInCloudDb(SAFEINCLOUD_XML, PASSWORD), PASSWORD);

    expect(read.ok && read.value.source).toBe('safeincloud');
    expect(read.ok ? read.value.cards.map(card => card.title) : []).toEqual([
      'Example mail',
      'Travel card',
    ]);
  });

  it('tells a wrong password apart from a damaged file', async () => {
    const file = await aSafeInCloudDb(SAFEINCLOUD_XML, PASSWORD);
    const damaged = file.slice(0, file.length - 1);

    expect(await readSafeInCloudDb(file, 'wrong')).toEqual({ ok: false, error: 'wrong-password' });
    expect(await readSafeInCloudDb(damaged, PASSWORD)).toEqual({
      ok: false,
      error: 'unreadable',
    });
  });

  it('opens a database whose password the app wrote one byte per character', async () => {
    const password = 'pässwörd';
    const file = await aSafeInCloudDb(SAFEINCLOUD_XML, password, { latin1: true });

    expect((await readSafeInCloudDb(file, password)).ok).toBe(true);
  });

  it('reads nothing from a file cut inside its header', async () => {
    const file = await aSafeInCloudDb(SAFEINCLOUD_XML, PASSWORD);

    expect(startsWithSafeInCloudMagic(file)).toBe(true);
    expect(await readSafeInCloudDb(file.slice(0, 20), PASSWORD)).toEqual({
      ok: false,
      error: 'unreadable',
    });
  });
});
