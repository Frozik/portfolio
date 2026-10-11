import { aCardWith, aField } from '../testing/builders';
import { cardSubtitle } from './card-subtitle';
import type { TTemplateId } from './ids';

const INTERNET_ACCOUNT = 'internet-account' as TTemplateId;
const BANK_CARD = 'bank-card' as TTemplateId;

describe('cardSubtitle', () => {
  it('shows the login of an account, skipping an empty one', () => {
    const card = aCardWith([aField({ kind: 'login' }, ''), aField({ kind: 'login' }, 'jane-doe')], {
      templateId: INTERNET_ACCOUNT,
    });

    expect(cardSubtitle(card)).toBe('jane-doe');
  });

  it('shows only the last four digits of a card number', () => {
    const card = aCardWith(
      [aField({ kind: 'card-number' }, '4111 1111 1111 1234', { sensitive: true })],
      { templateId: BANK_CARD }
    );

    expect(cardSubtitle(card)).toBe('•••• 1234');
  });

  it('never shows a value the user marked secret, and nothing for a template without one', () => {
    const hiddenLogin = aCardWith([aField({ kind: 'login' }, 'jane-doe', { sensitive: true })], {
      templateId: INTERNET_ACCOUNT,
    });

    expect(cardSubtitle(hiddenLogin)).toBeNull();
    expect(cardSubtitle(aCardWith([aField({ kind: 'text' }, 'anything')]))).toBeNull();
  });
});
