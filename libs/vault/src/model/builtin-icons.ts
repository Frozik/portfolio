/** The icons a card may take instead of the automatic one, in the editor's groups and order. */
export const BUILTIN_ICON_GROUPS = [
  {
    group: 'internet',
    icons: [
      'globe',
      'at-sign',
      'mail',
      'message-circle',
      'share',
      'cloud',
      'code',
      'briefcase',
      'graduation-cap',
      'newspaper',
    ],
  },
  {
    group: 'finance',
    icons: [
      'credit-card',
      'landmark',
      'wallet',
      'piggy-bank',
      'banknote',
      'coins',
      'hand-coins',
      'receipt',
      'trending-up',
      'badge-percent',
      'bitcoin',
    ],
  },
  {
    group: 'shopping',
    icons: [
      'shopping-cart',
      'shopping-bag',
      'store',
      'ticket',
      'gift',
      'gamepad',
      'music',
      'clapperboard',
      'tv',
      'book-open',
      'headphones',
      'camera',
    ],
  },
  {
    group: 'devices',
    icons: [
      'wifi',
      'router',
      'server',
      'database',
      'network',
      'monitor',
      'laptop',
      'smartphone',
      'tablet',
      'hard-drive',
      'printer',
      'cpu',
      'terminal',
      'cctv',
    ],
  },
  {
    group: 'security',
    icons: [
      'key',
      'key-round',
      'lock',
      'shield',
      'shield-check',
      'fingerprint',
      'scan-face',
      'vault',
      'bot',
    ],
  },
  {
    group: 'documents',
    icons: [
      'id-card',
      'contact',
      'book-user',
      'file',
      'file-text',
      'file-badge',
      'scroll-text',
      'stamp',
      'folder',
      'sticky-note',
    ],
  },
  {
    group: 'home',
    icons: [
      'house',
      'building',
      'zap',
      'droplet',
      'flame',
      'plug',
      'phone',
      'utensils',
      'shopping-basket',
      'calendar',
    ],
  },
  {
    group: 'travel',
    icons: ['car', 'fuel', 'plane', 'train', 'bus', 'bike', 'hotel', 'map-pin'],
  },
  {
    group: 'health',
    icons: ['heart-pulse', 'stethoscope', 'pill', 'dumbbell', 'baby', 'dog', 'cat', 'heart'],
  },
] as const;

export type TBuiltinIconGroup = (typeof BUILTIN_ICON_GROUPS)[number]['group'];
export type TBuiltinIcon = (typeof BUILTIN_ICON_GROUPS)[number]['icons'][number];

export const BUILTIN_ICONS: readonly TBuiltinIcon[] = BUILTIN_ICON_GROUPS.flatMap(
  ({ icons }) => icons
);
