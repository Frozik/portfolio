import {
  canUseMasterCharacters,
  masterCharactersCode,
  pinCode,
  typedCharactersCode,
} from './quick-code';

describe('a quick unlock code', () => {
  it('is a PIN of four to eight digits', () => {
    expect(pinCode('1234')).toEqual({ ok: true, value: 'pin:1234' });
    expect(pinCode('12345678')).toEqual({ ok: true, value: 'pin:12345678' });
    expect(pinCode('123')).toEqual({ ok: false, error: 'too-short' });
    expect(pinCode('123456789')).toEqual({ ok: false, error: 'too-long' });
    expect(pinCode('12a4')).toEqual({ ok: false, error: 'not-digits' });
  });

  it('takes four characters of a master password long enough to spare them', () => {
    const master = 'correct horse battery';

    expect(masterCharactersCode('first-four', master)).toBe('first-four:corr');
    expect(masterCharactersCode('last-four', master)).toBe('last-four:tery');
    expect(masterCharactersCode('first-four', 'short pass')).toBeNull();
    expect(canUseMasterCharacters('exactly12chr')).toBe(true);
  });

  it('counts characters as seen, so an emoji or an accent is one', () => {
    const master = 'пароль-длинный-🙂é';

    expect(masterCharactersCode('last-four', master)).toBe('last-four:й-🙂é');
  });

  it('matches what is typed at the lock with what the master password gave', () => {
    const master = 'Grüße aus Amsterdam';

    expect(typedCharactersCode('first-four', 'Grüß')).toBe(
      masterCharactersCode('first-four', master)
    );
  });
});
