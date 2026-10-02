import { describe, expect, it } from 'vitest';

import { channelsOf, cssOf, rgba, withAlpha } from './color';

describe('colour', () => {
  it('keeps every channel at full range, blue included', () => {
    expect(channelsOf(rgba(1, 1, 1, 1))).toEqual({ red: 1, green: 1, blue: 1, alpha: 1 });
    expect(rgba(1, 1, 1, 1)).toBe(0xffffffff);
  });

  it('packs red into the low byte and alpha into the high one', () => {
    expect(rgba(1, 0, 0, 0)).toBe(0x000000ff);
    expect(rgba(0, 0, 0, 1)).toBe(0xff000000);
  });

  it('clamps channels outside 0…1', () => {
    expect(channelsOf(rgba(2, -1, 0.5, 1))).toMatchObject({ red: 1, green: 0 });
  });

  it('changes transparency without touching the colour', () => {
    expect(channelsOf(withAlpha(rgba(0.2, 0.4, 0.6), 0))).toMatchObject({ alpha: 0 });
    expect(withAlpha(rgba(1, 0, 0), 1)).toBe(rgba(1, 0, 0, 1));
  });

  it('writes itself as a CSS colour for the 2D canvas', () => {
    expect(cssOf(rgba(1, 0, 0, 0.5))).toBe('rgba(255, 0, 0, 0.5019607843137255)');
  });
});
