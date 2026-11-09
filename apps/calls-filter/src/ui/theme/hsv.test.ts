import type { THexColor } from '../../contexts/grouping/domain/group';
import { hexToHsv, hsvToHex } from './hsv';

describe('a colour on the picker', () => {
  it('turns hue, saturation and value into hex', () => {
    expect(hsvToHex({ hue: 0, saturation: 1, value: 1 })).toBe('#ff0000');
    expect(hsvToHex({ hue: 32, saturation: 1, value: 1 })).toBe('#ff8800');
    expect(hsvToHex({ hue: 210, saturation: 0, value: 0.5 })).toBe('#808080');
  });

  it('finds where a typed colour sits on the picker, and back', () => {
    for (const hex of ['#ff8800', '#1f6feb', '#3fb950', '#000000', '#ffffff'] as THexColor[]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });
});
