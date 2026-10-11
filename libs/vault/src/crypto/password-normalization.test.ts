import { encodePassword } from './password-normalization';

describe('password encoding', () => {
  it('encodes the composed and the decomposed "й" to the same bytes', () => {
    expect(encodePassword('й')).toEqual(encodePassword('й'));
  });

  it('keeps whitespace and case as typed', () => {
    expect(new TextDecoder().decode(encodePassword(' Pass word '))).toBe(' Pass word ');
  });
});
