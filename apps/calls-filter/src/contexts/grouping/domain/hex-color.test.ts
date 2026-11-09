import { parseHexColor } from './hex-color';

describe('a colour typed as hex', () => {
  it('reads FF8800 with or without the hash, in any case', () => {
    expect(parseHexColor('FF8800')).toBe('#ff8800');
    expect(parseHexColor(' #ff8800 ')).toBe('#ff8800');
  });

  it('reads the short form F80 as FF8800', () => {
    expect(parseHexColor('F80')).toBe('#ff8800');
  });

  it('is no colour when it is not six or three hex digits', () => {
    expect(parseHexColor('FF880')).toBeNull();
    expect(parseHexColor('orange')).toBeNull();
    expect(parseHexColor('GG8800')).toBeNull();
  });
});
