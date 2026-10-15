import { assert } from '@frozik/utils/assert/assert';
import { camelCase, isNil, mapKeys, mapValues } from 'lodash-es';

import type { TColorRole } from './color-roles';
import { COLOR_ROLES } from './color-roles';

type TCamelRole<T extends string> = T extends `${infer Head}-${infer Tail}`
  ? `${Head}${Capitalize<TCamelRole<Tail>>}`
  : T;

export type TNativePalette = Readonly<Record<TCamelRole<TColorRole>, string>>;

const HEX = /^#[0-9a-f]{6}$/i;
const SPACE_SEPARATED_RGB = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/;

/** React Native reads `#rrggbb` and `rgba(r, g, b, a)`, not the CSS 4 space-separated form. */
function nativeColor(color: string): string {
  if (HEX.test(color)) {
    return color;
  }
  const match = SPACE_SEPARATED_RGB.exec(color);
  assert(!isNil(match), `Not a colour the roles may use: ${color}`);
  const [, red, green, blue, alpha] = match;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function paletteOf(scheme: 'light' | 'dark'): TNativePalette {
  return mapKeys(
    mapValues(COLOR_ROLES, pair => nativeColor(pair[scheme])),
    (_color, role) => camelCase(role)
  ) as TNativePalette;
}

/** The colour roles for `StyleSheet`, one palette per scheme. */
export const NATIVE_PALETTES: Readonly<Record<'light' | 'dark', TNativePalette>> = {
  light: paletteOf('light'),
  dark: paletteOf('dark'),
};
