import type { TE164Digits } from '../domain/caller';
import type { INumberingMask } from '../domain/numbering/gen/numbering-codes';
import { NumberingCatalogue } from './NumberingCatalogue';

const RUSSIA: readonly INumberingMask[] = [
  {
    mask: '+7*',
    countryCode: 'RU',
    children: [{ mask: '+7915*', countryCode: 'RU', networkOperatorCode: 'mts' }],
  },
];
const MOBILE = '79151234567' as TE164Digits;

function catalogueOf(load: () => Promise<readonly INumberingMask[]>) {
  const errors: string[] = [];
  const catalogue = new NumberingCatalogue(load, {
    log: (_level, _category, event) => errors.push(event),
    latest: () => [],
  });
  return { catalogue, errors };
}

describe('the numbering catalogue in the app', () => {
  it('knows nothing until it has loaded, then where a number is from', async () => {
    const { catalogue } = catalogueOf(async () => RUSSIA);
    const before = catalogue.detailsOf(MOBILE);
    await catalogue.open();
    expect([before, catalogue.detailsOf(MOBILE)]).toEqual([
      null,
      { country: 'RU', states: [], operator: 'mts', service: null },
    ]);
  });

  it('records a catalogue that does not load, and goes on without it', async () => {
    const { catalogue, errors } = catalogueOf(() => Promise.reject(new Error('gone')));
    await catalogue.open();
    expect([catalogue.detailsOf(MOBILE), errors]).toEqual([null, ['numbering-catalogue-failed']]);
  });
});
