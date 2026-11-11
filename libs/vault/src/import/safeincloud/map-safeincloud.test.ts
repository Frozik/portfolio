import { zlibSync } from 'fflate';

import { toBase64, utf8 } from '../../crypto/bytes';
import { importSafeInCloud } from './map-safeincloud';
import { parseSafeInCloud } from './parse-safeincloud';

const PDF = utf8('%PDF-1.4 a scan');
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3);

function database(attachments: string) {
  const parsed = parseSafeInCloud(
    `<database><card title="Passport" id="1"><field name="Number" type="number">123</field>${attachments}</card></database>`
  );
  if (parsed === null) {
    throw new Error('not SafeInCloud');
  }
  return parsed;
}

describe('SafeInCloud attachments', () => {
  it('bring a card’s files and pictures along as its files', async () => {
    const batch = await importSafeInCloud(
      database(
        `<file name="scan.pdf">${toBase64(zlibSync(PDF))}</file><image>${toBase64(JPEG)}</image>`
      )
    );
    const [card] = batch.cards;
    const files = card?.tabs[0]?.fields.find(field => field.spec.kind === 'file');

    expect({
      assets: batch.assets.map(({ asset, bytes }) => ({
        name: asset.name,
        mime: asset.mime,
        bytes: [...bytes],
      })),
      field: files?.value,
      warnings: batch.warnings,
    }).toEqual({
      assets: [
        { name: 'scan.pdf', mime: 'application/pdf', bytes: [...PDF] },
        { name: 'image1.jpg', mime: 'image/jpeg', bytes: [...JPEG] },
      ],
      field: { cardinality: 'list', values: batch.assets.map(({ asset }) => asset.id) },
      warnings: [],
    });
  });

  it('report a file that does not decode and keep the rest of the card', async () => {
    const batch = await importSafeInCloud(
      database('<file name="broken.pdf">not base64 at all!</file>')
    );

    expect({
      cards: batch.cards.map(card => card.title),
      assets: batch.assets.length,
      warnings: batch.warnings,
    }).toEqual({
      cards: ['Passport'],
      assets: 0,
      warnings: [{ kind: 'file-dropped', card: 'Passport', name: 'broken.pdf' }],
    });
  });
});

describe('SafeInCloud expiries', () => {
  it('keep the day a document expires on, and a card’s month as a month', async () => {
    const parsed = parseSafeInCloud(
      `<database><card title="Insurance" id="1"><field name="Valid until" type="expiry">10.11.2027</field></card><card title="Card" id="2"><field name="Expiry" type="expiry">11.27</field><field name="PIN" type="pin">1234</field></card></database>`
    );
    if (parsed === null) {
      throw new Error('not SafeInCloud');
    }

    const batch = await importSafeInCloud(parsed);

    expect(
      batch.cards.map(card =>
        card.tabs[0]?.fields.map(field => [
          field.spec.kind,
          field.value.cardinality === 'single' ? field.value.value : field.value.values,
        ])
      )
    ).toEqual([
      [['expiry-date', '10.11.2027']],
      [
        ['expiry-month', '11.27'],
        ['pin', '1234'],
      ],
    ]);
  });
});

describe('SafeInCloud numbers', () => {
  it('take a bank card’s number as a card number, so its network shows; other numbers stay text', async () => {
    const parsed = parseSafeInCloud(
      `<database><card title="Visa" id="1"><field name="Number" type="number">4111 1111 1111 1111</field></card><card title="Passport" id="2"><field name="Number" type="number">4111111111111112</field><field name="Account" type="number">12345678</field></card></database>`
    );
    if (parsed === null) {
      throw new Error('not SafeInCloud');
    }

    const batch = await importSafeInCloud(parsed);

    expect(
      batch.cards.map(card => ({
        template: card.templateId,
        kinds: card.tabs[0]?.fields.map(field => field.spec.kind),
      }))
    ).toEqual([
      { template: 'bank-card', kinds: ['card-number'] },
      { template: 'blank', kinds: ['text', 'text'] },
    ]);
  });
});

describe('SafeInCloud cards of every network', () => {
  it('find a card number in a text field too, and take UnionPay’s without a Luhn digit, as its cards may have none', async () => {
    const parsed = parseSafeInCloud(
      `<database><card title="Mir" id="1"><field name="Card" type="text">2200 1234 5600 0003</field></card><card title="UnionPay" id="2"><field name="Number" type="number">6250941006528590</field></card><card title="Tax" id="3"><field name="INN" type="text">502312345678</field></card></database>`
    );
    if (parsed === null) {
      throw new Error('not SafeInCloud');
    }

    const batch = await importSafeInCloud(parsed);

    expect(batch.cards.map(card => card.tabs[0]?.fields.map(field => field.spec.kind))).toEqual([
      ['card-number'],
      ['card-number'],
      ['text'],
    ]);
  });
});

describe('SafeInCloud sites', () => {
  it('take a web address in a text field as a site, so its icon shows; other text stays text', async () => {
    const parsed = parseSafeInCloud(
      `<database><card title="Exchange" id="1"><field name="Веб-сайт" type="text">https://www.binance.com</field><field name="Note" type="text">see https://binance.com</field></card></database>`
    );
    if (parsed === null) {
      throw new Error('not SafeInCloud');
    }

    const batch = await importSafeInCloud(parsed);

    expect(batch.cards[0]?.tabs[0]?.fields.map(field => field.spec.kind)).toEqual(['url', 'text']);
  });
});

describe('SafeInCloud bank cards of a network no list names', () => {
  it('take the number of a card with a month to expire or a PIN as a card number all the same', async () => {
    const parsed = parseSafeInCloud(
      `<database><card title="Local card" id="1"><field name="Number" type="number">9999 1234 5678 9019</field><field name="Expiry" type="expiry">11/27</field></card><card title="Membership" id="2"><field name="Number" type="number">9999123456789019</field></card></database>`
    );
    if (parsed === null) {
      throw new Error('not SafeInCloud');
    }

    const batch = await importSafeInCloud(parsed);

    expect(
      batch.cards.map(card => ({
        template: card.templateId,
        kinds: card.tabs[0]?.fields.map(field => field.spec.kind),
      }))
    ).toEqual([
      { template: 'bank-card', kinds: ['card-number', 'expiry-month'] },
      { template: 'blank', kinds: ['text'] },
    ]);
  });
});
