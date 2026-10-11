import { aCard, aCardWith, aField } from '../../testing/builders';
import type { TFieldKind } from '../card';
import { BANK_ACCOUNT_TEMPLATE } from '../templates/bank-account';
import { FIELD_KINDS } from './registry';

const card = aCard({ title: 'My Bank' });

function normalize(kind: TFieldKind, value: string, context = card): string {
  const row = FIELD_KINDS[kind];
  return row.normalize(value, { spec: row.defaultSpec, card: context });
}

function validate(kind: TFieldKind, value: string, context = card): string {
  const row = FIELD_KINDS[kind];
  return row.validate(value, { spec: row.defaultSpec, card: context }).kind;
}

describe('field kinds', () => {
  it('has one row per kind, each under its own name', () => {
    for (const [kind, row] of Object.entries(FIELD_KINDS)) {
      expect(row.kind).toBe(kind);
      expect(row.defaultSpec.kind).toBe(kind);
    }
  });

  it.each([
    ['password', true, true],
    ['secret', true, true],
    ['pin', true, false],
    ['otp', true, false],
    ['card-number', true, false],
    ['cvv', true, false],
    ['security-question', true, false],
    ['text', false, true],
    ['email', false, true],
    ['phone', false, true],
    ['url', false, true],
    ['select', false, true],
    ['file', false, true],
    ['login', false, false],
    ['iban', false, false],
    ['bank-code', false, false],
    ['bank-account', false, false],
    ['note', false, false],
  ] as const)('marks %s secret by default: %s, and a list: %s', (kind, sensitive, list) => {
    expect(FIELD_KINDS[kind].sensitiveByDefault).toBe(sensitive);
    expect(FIELD_KINDS[kind].listAllowed).toBe(list);
  });

  it('never puts a kind that is secret by default into the search index', () => {
    for (const row of Object.values(FIELD_KINDS)) {
      expect(row.sensitiveByDefault && row.searchable).toBe(false);
    }
  });

  it.each([
    ['url', 'example.com/login', 'https://example.com/login'],
    ['url', 'ftp://files.example', 'ftp://files.example'],
    ['phone', '+7 (912) 345-67-89', '+79123456789'],
    ['phone', '8 912 345 67 89', '8 912 345 67 89'],
    ['card-number', '4111 1111-1111 1111', '4111111111111111'],
    ['iban', 'de89 3704 0044 0532 0130 00', 'DE89370400440532013000'],
    ['bic', 'sabr ru mm', 'SABRRUMM'],
    ['expiry-month', '12/27', '2027-12'],
    ['expiry-month', '3/2031', '2031-03'],
    ['expiry-date', '17.05.2031', '2031-05-17'],
    ['password', ' keep  me ', ' keep  me '],
    [
      'otp',
      'jbsw y3dp ehpk 3pxp',
      'otpauth://totp/My%20Bank?secret=JBSWY3DPEHPK3PXP&algorithm=SHA1&digits=6&period=30',
    ],
  ] as const)('normalizes %s "%s" to "%s"', (kind, typed, stored) => {
    expect(normalize(kind, typed)).toBe(stored);
  });

  it.each([
    ['email', 'alice@example.com', 'valid'],
    ['email', 'alice', 'warning'],
    ['url', 'https://example.com', 'valid'],
    ['url', 'https://exa mple.com', 'invalid'],
    ['pin', '0420', 'valid'],
    ['pin', '04a0', 'invalid'],
    ['cvv', '12', 'warning'],
    ['card-number', '4111111111111111', 'valid'],
    ['card-number', '4111111111111112', 'warning'],
    ['card-number', '411111111111111', 'warning'],
    ['expiry-month', '2027-13', 'invalid'],
    ['expiry-date', '2031-02-30', 'invalid'],
    ['boolean', 'yes', 'invalid'],
    ['iban', 'DE89370400440532013000', 'valid'],
    ['iban', 'GB82WEST12345698765432', 'valid'],
    ['iban', 'FR1420041010050500013M02606', 'valid'],
    ['iban', 'NL91ABNA0417164300', 'valid'],
    ['iban', 'ES9121000418450200051332', 'valid'],
    ['iban', 'IT60X0542811101000000123456', 'valid'],
    ['iban', 'CH9300762011623852957', 'valid'],
    ['iban', 'PL61109010140000071219812874', 'valid'],
    ['iban', 'DE89370400440532013001', 'warning'],
    ['bic', 'DEUTDEFF', 'valid'],
    ['bic', 'CHASUS33XXX', 'valid'],
    ['bic', '044525225', 'warning'],
    ['bank-code', '37040044', 'valid'],
    ['bank-code', '30004', 'valid'],
    ['bank-account', '000123456789', 'valid'],
    ['bank-account', '31926819', 'valid'],
    ['otp', 'otpauth://totp/x?secret=JBSWY3DP', 'valid'],
    ['otp', 'not a code', 'invalid'],
    ['text', '', 'valid'],
    ['pin', '', 'valid'],
  ] as const)('validates %s "%s" as %s', (kind, value, outcome) => {
    expect(validate(kind, value)).toBe(outcome);
  });

  it('checks the Bank of Russia key only next to a Russian BIC, and nothing elsewhere', () => {
    const russian = aCardWith([aField({ kind: 'bank-code', scheme: 'ru-bic' }, '044525225')]);
    const american = aCardWith([aField({ kind: 'bank-code', scheme: 'aba-routing' }, '021000021')]);

    expect(validate('bank-account', '30101810400000000225', russian)).toBe('valid');
    expect(validate('bank-account', '30101810400000000226', russian)).toBe('warning');
    expect(validate('bank-account', '123', russian)).toBe('warning');
    expect(validate('bank-account', '30101810400000000226', american)).toBe('valid');
    expect(validate('bank-account', '123456789012', american)).toBe('valid');
  });

  it('takes the bank code of any country by default, and so does the international template', () => {
    const template = BANK_ACCOUNT_TEMPLATE.tabs[0].fields.find(field => field.kind === 'bank-code');

    expect(FIELD_KINDS['bank-code'].defaultSpec).toEqual({ kind: 'bank-code', scheme: 'national' });
    expect(template?.spec).toEqual({ kind: 'bank-code', scheme: 'national' });
  });

  it('shows a bank code the way its scheme prints it', () => {
    expect(
      FIELD_KINDS['bank-code'].format('200000', { kind: 'bank-code', scheme: 'sort-code' })
    ).toBe('20-00-00');
    expect(FIELD_KINDS['bank-code'].format('062000', { kind: 'bank-code', scheme: 'bsb' })).toBe(
      '062-000'
    );
    expect(
      FIELD_KINDS['bank-code'].format('37040044', { kind: 'bank-code', scheme: 'national' })
    ).toBe('37040044');
  });

  it('checks a bank code by the scheme of its field', () => {
    const row = FIELD_KINDS['bank-code'];
    const sortCode = { kind: 'bank-code', scheme: 'sort-code' } as const;

    expect(row.normalize('20-00-00', { spec: sortCode, card })).toBe('200000');
    expect(row.validate('200000', { spec: sortCode, card }).kind).toBe('valid');
    expect(row.validate('021000021', { spec: sortCode, card }).kind).toBe('warning');
  });

  it('accepts only the options of a closed select', () => {
    const row = FIELD_KINDS.select;
    const spec = { kind: 'select', options: ['WPA2', 'WPA3'], allowCustom: false } as const;

    expect(row.validate('WPA3', { spec, card }).kind).toBe('valid');
    expect(row.validate('WEP', { spec, card }).kind).toBe('invalid');
    expect(row.validate('WEP', { spec: { ...spec, allowCustom: true }, card }).kind).toBe('valid');
  });

  it('shows and copies values in their usual forms', () => {
    expect(FIELD_KINDS.iban.format('DE89370400440532013000', { kind: 'iban' })).toBe(
      'DE89 3704 0044 0532 0130 00'
    );
    expect(FIELD_KINDS.iban.copyValue('DE89370400440532013000')).toBe('DE89370400440532013000');
    expect(FIELD_KINDS['card-number'].format('4111111111111111', { kind: 'card-number' })).toBe(
      '4111 1111 1111 1111'
    );
    expect(FIELD_KINDS['expiry-month'].format('2027-12', { kind: 'expiry-month' })).toBe('12/27');
  });
});
