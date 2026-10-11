import { isNil } from 'lodash-es';
import { z } from 'zod';

import type { TBuiltinIcon } from '../model/builtin-icons';
import { BUILTIN_ICONS } from '../model/builtin-icons';
import type { ICardState } from '../model/card';
import { CARD_COLORS } from '../model/card-appearance';

/**
 * What CXF has no field for, as an item extension of our own:
 * named `<rpId>/pwv-appearance` (CXF reserves bare names for itself), so any
 * copy of this app reads it back and other managers skip it.
 */
export const APPEARANCE_EXTENSION = 'pwv-appearance';

const APPEARANCE_SCHEMA = z.object({
  name: z.string().endsWith(`/${APPEARANCE_EXTENSION}`),
  color: z.enum(CARD_COLORS).nullable().catch(null).optional(),
  icon: z.enum(BUILTIN_ICONS).nullable().catch(null).optional(),
  protected: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export type TCardAppearance = Pick<ICardState, 'color' | 'protected'> & {
  readonly icon: TBuiltinIcon | null;
  readonly archived: boolean;
};

/** The extension for a card that differs from the defaults; `null` for one that does not. */
export function appearanceExtension(
  rpId: string,
  card: ICardState
): Readonly<Record<string, unknown>> | null {
  const icon = card.icon.kind === 'builtin' ? card.icon.name : null;
  const archived = !isNil(card.archivedAt);
  if (isNil(card.color) && isNil(icon) && !card.protected && !archived) {
    return null;
  }
  return {
    name: `${rpId}/${APPEARANCE_EXTENSION}`,
    color: card.color,
    icon,
    protected: card.protected,
    archived,
  };
}

export function appearanceOf(extensions: readonly unknown[] | undefined): TCardAppearance | null {
  for (const extension of extensions ?? []) {
    const parsed = APPEARANCE_SCHEMA.safeParse(extension);
    if (parsed.success) {
      return {
        color: parsed.data.color ?? null,
        icon: parsed.data.icon ?? null,
        protected: parsed.data.protected ?? false,
        archived: parsed.data.archived ?? false,
      };
    }
  }
  return null;
}
