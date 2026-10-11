import { normalizeSecretInput } from './secret-input';

describe('secret input', () => {
  it('takes any text for a password, spaces included', () => {
    expect(normalizeSecretInput(' pass word ', {})).toBe(' pass word ');
  });

  it.each([
    ['0420', '0420'],
    ['1234 5678', '12345678'],
    ['12-34', '1234'],
    ['12a4', undefined],
  ])('reads %s typed into a PIN as %s', (typed, stored) => {
    expect(normalizeSecretInput(typed, { digitsOnly: true })).toBe(stored);
  });

  it('refuses an edit past the length a CVV allows', () => {
    expect(normalizeSecretInput('123', { digitsOnly: true, maxLength: 4 })).toBe('123');
    expect(normalizeSecretInput('12345', { digitsOnly: true, maxLength: 4 })).toBeUndefined();
  });
});
