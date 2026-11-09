import type { TColorSlot, TGroupColor } from '../../contexts/grouping/domain/group';
import { COLOR_SLOTS } from '../../contexts/grouping/domain/group';
import type { TScheme } from './AppTheme';

/** Each slot as a pair that keeps its contrast on the light and on the dark background. */
const SLOT_PALETTE: Readonly<Record<TColorSlot, Readonly<Record<TScheme, string>>>> = {
  blue: { light: '#1f6feb', dark: '#58a6ff' },
  teal: { light: '#0f7b7b', dark: '#3fc1c1' },
  green: { light: '#1a7f37', dark: '#3fb950' },
  amber: { light: '#9a6700', dark: '#d29922' },
  orange: { light: '#bc4c00', dark: '#f0883e' },
  red: { light: '#cf222e', dark: '#f85149' },
  pink: { light: '#bf3989', dark: '#db61a2' },
  violet: { light: '#8250df', dark: '#a371f7' },
  slate: { light: '#57606a', dark: '#8b949e' },
};

const isSlot = (color: TGroupColor): color is TColorSlot =>
  (COLOR_SLOTS as readonly string[]).includes(color);

/** A slot in the theme's shade; a colour of the user's own as it is. */
export function groupColor(color: TGroupColor, scheme: TScheme): string {
  return isSlot(color) ? SLOT_PALETTE[color][scheme] : color;
}
