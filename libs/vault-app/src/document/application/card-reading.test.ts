import type { ICardField } from '@frozik/vault/model/card';
import type { TFieldId } from '@frozik/vault/model/ids';
import { aCardWith } from '@frozik/vault/testing/builders';

import { readCard } from './card-reading';
import { cardRowOf } from './card-row';

function aField(field: Partial<ICardField> & Pick<ICardField, 'spec' | 'value'>): ICardField {
  return {
    id: `field-${field.spec.kind}` as TFieldId,
    label: field.spec.kind,
    sensitive: false,
    excludeFromAudit: false,
    ...field,
  };
}

const PASSWORD = aField({
  spec: { kind: 'password', rotateEveryDays: null },
  value: { cardinality: 'single', value: 'hunter2' },
  sensitive: true,
});
const OTP_URI = 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP';
const OTP = aField({
  spec: { kind: 'otp' },
  value: { cardinality: 'single', value: OTP_URI },
  sensitive: true,
});
const EMPTY = aField({ spec: { kind: 'text' }, value: { cardinality: 'single', value: '' } });

function cardWith(fields: readonly ICardField[]) {
  return aCardWith(fields, { title: 'Bank' });
}

describe('reading a card', () => {
  it('shows a secret as its value to reveal, copy and enlarge, and leaves empty fields out', () => {
    const [tab] = readCard(cardWith([PASSWORD, EMPTY]), false).tabs;

    expect(tab?.fields).toEqual([
      {
        id: PASSWORD.id,
        label: PASSWORD.label,
        kind: 'values',
        sensitive: true,
        copyable: true,
        largeType: true,
        values: [{ index: 0, text: 'hunter2', copyText: 'hunter2', turn: null }],
      },
    ]);
  });

  it('turns a one-time-code field into its live code', () => {
    const [tab] = readCard(cardWith([OTP]), false).tabs;

    expect(tab?.fields[0]).toMatchObject({ kind: 'one-time-code', uri: OTP_URI });
  });

  it('keeps a shut card’s secrets masked, uncopied and its code unread', () => {
    const [tab] = readCard(cardWith([PASSWORD, OTP]), true).tabs;

    expect(tab?.fields.map(field => field.kind)).toEqual(['values', 'values']);
    expect(tab?.fields.every(field => field.kind === 'values' && !field.copyable)).toBe(true);
  });

  it('copies a card number without the spaces it is shown with', () => {
    const number = aField({
      spec: { kind: 'card-number' },
      value: { cardinality: 'single', value: '4111111111111111' },
    });
    const [tab] = readCard(cardWith([number]), false).tabs;
    const reading = tab?.fields[0];

    expect(reading?.kind === 'values' && reading.values[0]).toMatchObject({
      text: '4111 1111 1111 1111',
      copyText: '4111111111111111',
    });
  });
});

describe('a card in a list', () => {
  it('flags only an expiry that needs attention, and a one-time code', () => {
    const card = cardWith([OTP]);

    expect(cardRowOf(card, 'ok')).toMatchObject({ expiry: null, hasOneTimeCode: true });
    expect(cardRowOf(card, 'expired').expiry).toBe('expired');
  });
});
