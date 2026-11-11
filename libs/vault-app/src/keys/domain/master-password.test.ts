import { masterPasswordProblem, passwordAdvice } from './master-password';

const LONG = 'correct horse battery';

describe('masterPasswordProblem', () => {
  it('takes any password, even one character, and asks nothing about its kind', () => {
    expect(masterPasswordProblem({ password: '', confirmation: '', acknowledged: true })).toBe(
      'no-password'
    );
    expect(
      masterPasswordProblem({ password: 'a', confirmation: 'a', acknowledged: true })
    ).toBeNull();
  });

  it('wants the same password twice and the "no recovery" box ticked', () => {
    expect(
      masterPasswordProblem({ password: LONG, confirmation: `${LONG}!`, acknowledged: true })
    ).toBe('mismatch');
    expect(masterPasswordProblem({ password: LONG, confirmation: LONG, acknowledged: false })).toBe(
      'not-acknowledged'
    );
  });
});

describe('passwordAdvice', () => {
  it('suggests what the password lacks: length, digits, capitals, symbols', () => {
    expect(passwordAdvice('secret')).toEqual(['longer', 'digits', 'capitals', 'symbols']);
    expect(passwordAdvice('Секрет-2024')).toEqual(['longer']);
    expect(passwordAdvice('Correct horse battery 7')).toEqual([]);
  });

  it('counts an emoji as one character, not two', () => {
    expect(passwordAdvice('Abcdefghijk1!😀').includes('longer')).toBe(true);
    expect(passwordAdvice('Abcdefghijk12!😀').includes('longer')).toBe(false);
  });
});
