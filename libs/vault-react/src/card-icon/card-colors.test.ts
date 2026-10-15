import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CARD_COLOR_SHADES, CARD_COLORS } from '@frozik/vault/model/card-appearance';

const css = readFileSync(join(import.meta.dirname, 'card-icon.module.css'), 'utf8');

describe('the card colours of the web icon', () => {
  it('draws each colour in the shades every client shares', () => {
    const drawn = Object.fromEntries(
      CARD_COLORS.map(color => {
        const rule = new RegExp(
          `\\.${color} \\{\\s*--card-color: light-dark\\((#[0-9a-f]{6}), (#[0-9a-f]{6})\\);`
        ).exec(css);
        return [color, { light: rule?.[1], dark: rule?.[2] }];
      })
    );

    expect(drawn).toEqual(CARD_COLOR_SHADES);
  });
});
