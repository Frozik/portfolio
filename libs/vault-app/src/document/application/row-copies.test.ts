import type { TTemplateId } from '@frozik/vault/model/ids';
import { aCardWith, aField } from '@frozik/vault/testing/builders';

import { rowCopiesOf } from './row-copies';

const OTP = 'otpauth://totp/Site:jane?secret=JBSWY3DPEHPK3PXP';

function copiesOf(...args: Parameters<typeof aCardWith>) {
  return rowCopiesOf(aCardWith(...args)).map(copy => [copy.role, copy.text]);
}

describe('what a row copies', () => {
  it('offers an account its login, the password in use and the one-time code, nothing else', () => {
    expect(
      copiesOf(
        [
          aField({ kind: 'text' }, 'not offered'),
          aField({ kind: 'email' }, 'jane@mail.example'),
          aField({ kind: 'login' }, 'jane'),
          aField({ kind: 'password', rotateEveryDays: null }, ['new', 'old'], { sensitive: true }),
          aField({ kind: 'otp' }, OTP, { sensitive: true }),
        ],
        { templateId: 'internet-account' as TTemplateId }
      )
    ).toEqual([
      ['login', 'jane'],
      ['password', 'new'],
      ['one-time-code', OTP],
    ]);
  });

  it('lets the email stand in for a missing login, and offers nothing a card does not have', () => {
    expect(copiesOf([aField({ kind: 'email' }, 'jane@mail.example')])).toEqual([
      ['login', 'jane@mail.example'],
    ]);
  });

  it('offers a bank card its number, holder, expiry and PIN', () => {
    expect(
      copiesOf(
        [
          aField({ kind: 'card-number' }, '4111111111111111'),
          aField({ kind: 'text' }, 'JANE DOE'),
          aField({ kind: 'expiry-month' }, '2028-04'),
          aField({ kind: 'cvv' }, '123', { sensitive: true }),
          aField({ kind: 'pin' }, '4321', { sensitive: true }),
        ],
        { templateId: 'bank-card' as TTemplateId }
      )
    ).toEqual([
      ['card-number', '4111111111111111'],
      ['holder', 'JANE DOE'],
      ['expiry', '2028-04'],
      ['pin', '4321'],
    ]);
  });

  it('takes a bank account’s holder from the second text, after the bank', () => {
    expect(
      copiesOf(
        [
          aField({ kind: 'text' }, 'ING'),
          aField({ kind: 'text' }, 'Jane Doe'),
          aField({ kind: 'iban' }, 'NL91ABNA0417164300'),
          aField({ kind: 'bic' }, 'INGBNL2A'),
        ],
        { templateId: 'bank-account' as TTemplateId }
      )
    ).toEqual([
      ['iban', 'NL91ABNA0417164300'],
      ['bic', 'INGBNL2A'],
      ['holder', 'Jane Doe'],
    ]);
  });

  it('offers a Wi-Fi network its name and password', () => {
    expect(
      copiesOf(
        [
          aField({ kind: 'text' }, 'Home-5G'),
          aField({ kind: 'password', rotateEveryDays: null }, 'secret', { sensitive: true }),
        ],
        { templateId: 'wifi' as TTemplateId }
      )
    ).toEqual([
      ['network', 'Home-5G'],
      ['password', 'secret'],
    ]);
  });
});
