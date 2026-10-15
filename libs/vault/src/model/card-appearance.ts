import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TBuiltinIcon } from './builtin-icons';
import type { ICardState, TCardColor } from './card';
import { allFields } from './card';
import type { TCardNetwork } from './card-network';
import { detectCardNetwork } from './card-network';
import { templateOf } from './templates/registry';

/** The palette, in the order the editor offers it. */
export const CARD_COLORS = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'violet',
  'pink',
  'slate',
] as const satisfies readonly TCardColor[];

/** Each colour as a light and a dark scheme draw it: the editor's swatches and the icon. */
export const CARD_COLOR_SHADES: Readonly<
  Record<TCardColor, { readonly light: string; readonly dark: string }>
> = {
  red: { light: '#dc2626', dark: '#f87171' },
  orange: { light: '#ea580c', dark: '#fb923c' },
  amber: { light: '#d97706', dark: '#fbbf24' },
  green: { light: '#16a34a', dark: '#4ade80' },
  teal: { light: '#0d9488', dark: '#2dd4bf' },
  blue: { light: '#2563eb', dark: '#60a5fa' },
  indigo: { light: '#4f46e5', dark: '#818cf8' },
  violet: { light: '#7c3aed', dark: '#a78bfa' },
  pink: { light: '#db2777', dark: '#f472b6' },
  slate: { light: '#475569', dark: '#94a3b8' },
};

const NON_DIGIT = /\D/g;

/** The built-in icon a card draws: the chosen one, else its template's. */
export function builtinIconOf(card: ICardState): TBuiltinIcon {
  const { icon } = card;
  switch (icon.kind) {
    case 'builtin':
      return icon.name;
    case 'auto':
    case 'custom':
      return templateOf(card.templateId).icon;
    default:
      return assertNever(icon);
  }
}

/** The network of a card number, shown by a card that keeps the automatic icon. */
export function cardNetworkOf(card: ICardState): TCardNetwork | null {
  if (card.icon.kind !== 'auto') {
    return null;
  }
  const number = allFields(card).find(field => field.spec.kind === 'card-number');
  const digits =
    number?.value.cardinality === 'single' ? number.value.value.replace(NON_DIGIT, '') : '';
  return digits === '' ? null : (detectCardNetwork(digits)?.network ?? null);
}

/** Only a chosen built-in icon takes the card's colour; the automatic ones keep their own. */
export function cardColorOf(card: ICardState): TCardColor | null {
  return card.icon.kind === 'builtin' ? card.color : null;
}
