import { memo } from 'react';

import type { ItemId, WeaponFamily } from '../../domain/types';
import { SHOP_ICON_SIZE_PX } from '../constants';

/**
 * [§13] Our own iconography for the shop: one stroked glyph per weapon family and per accessory,
 * drawn in a 24 × 24 box. Vector rather than emoji on purpose — emoji render differently on every
 * platform, and the shop is the screen the design language is judged on.
 */
export type ShopGlyphId = WeaponFamily | ItemId;

const GLYPH_PATHS: Readonly<Record<ShopGlyphId, string>> = {
  // Weapons: a shell arcing, and the shapes each family leaves behind.
  ballistic: 'M3 20c6-14 12-14 18 0M18 6l3-1-1 3',
  leapfrog: 'M2 20c2-5 5-5 6 0M9 20c2-6 5-6 6 0M16 20c2-7 5-7 6 0',
  funky: 'M12 12l4-6M12 12l7 2M12 12l-2 7M12 12l-7-3M12 12l3 8',
  mirv: 'M12 3v6M12 9l-7 11M12 9l-3 11M12 9l3 11M12 9l7 11',
  napalm: 'M12 3c4 5 1 6 3 9a4 4 0 1 1-7 1c0-4 4-5 4-10ZM3 21h18',
  roller: 'M3 8h6l12 8M8 16a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
  'riot-charge': 'M12 4 4 18h16zM3 21h18',
  'riot-bomb': 'M12 4v5M6 20a6 6 0 0 1 12 0z',
  'dirt-deposit': 'M12 4a5 5 0 0 1 5 5c0 4-5 7-5 7s-5-3-5-7a5 5 0 0 1 5-5ZM3 21h18',
  'liquid-dirt': 'M3 16c3-3 6 3 9 0s6-3 9 0M3 21h18',
  'dirt-charge': 'M12 3v8M8 6l4-3 4 3M4 21c2-4 14-4 16 0z',
  plasma: 'M12 3v4M12 17v4M3 12h4M17 12h4M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  laser: 'M3 12h18M17 8l4 4-4 4',

  // Accessories: what each one does to a shell, a fall or a tank.
  'heat-guidance': 'M12 3v4M12 21v-4M3 12h4M21 12h-4M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
  'ballistic-guidance': 'M3 18c6-10 12-10 18 0M6 6l3 3M6 6h4M6 6v4',
  'horizontal-guidance': 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  'vertical-guidance': 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4',
  'lazy-boy': 'M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0M12 8v4l3 2',
  battery: 'M4 8h13v8H4zM17 11h3v2h-3M8 10l-1 4h3l-1 4',
  'mag-deflector': 'M6 18V9a6 6 0 0 1 12 0v9M4 18h4M16 18h4M12 3V1',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
  'force-shield': 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM9 11l2 2 4-4',
  'heavy-shield': 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 7v10M8 12h8',
  'super-mag': 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM8 12h8M12 8l-2 4h4l-2 4',
  'auto-defense': 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 8v3M12 14h.01',
  fuel: 'M5 20V5h8v15M5 12h8M15 8h3v8a2 2 0 0 1-4 0M3 20h12',
  'contact-trigger': 'M12 3v6M12 15a3 3 0 1 0 0 6 3 3 0 1 0 0-6M9 9h6l-1 4h-4z',
};

export const ShopGlyph = memo(
  ({
    glyphId,
    sizePx = SHOP_ICON_SIZE_PX,
  }: {
    readonly glyphId: ShopGlyphId;
    /** The shop draws these at card size; the HUD badges reuse them at icon size. */
    readonly sizePx?: number;
  }) => (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width={sizePx}
      height={sizePx}
      className="shrink-0 fill-none stroke-current stroke-[1.4]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={GLYPH_PATHS[glyphId]} />
    </svg>
  )
);
