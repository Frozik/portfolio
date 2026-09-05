/** GPU-ready RGB float triple (0..1 range). */
export type RgbFloat = readonly [number, number, number];

type LineStyle =
  | { readonly type: 'solid' }
  /** dash/gap are world units along the segment — the pattern is anchored to
   *  the geometry (both endpoints end in a dash) and stable under camera motion */
  | { readonly type: 'dashed'; readonly dash: number; readonly gap: number };

type MarkerType = 'solid' | 'circle';

/** One entry of the style map; every field falls back to the less specific entry. */
export interface PartialElementStyle {
  readonly color?: string;
  readonly width?: number;
  readonly size?: number;
  readonly alpha?: number;
  readonly line?: LineStyle;
  readonly markerType?: MarkerType;
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
}

export interface ResolvedElementStyle {
  readonly color: string;
  readonly width: number;
  readonly size: number;
  readonly alpha: number;
  readonly line: LineStyle;
  readonly markerType: MarkerType;
  readonly strokeColor: string;
  readonly strokeWidth: number;
}

const DEFAULT_ELEMENT_STYLE: ResolvedElementStyle = {
  color: '#FFFFFF',
  width: 1.0,
  size: 1.0,
  alpha: 1.0,
  line: { type: 'solid' },
  markerType: 'solid',
  strokeColor: '#FFFFFF',
  strokeWidth: 0,
};

const HEX_RADIX = 16;
const HEX_COLOR_LENGTH = 7;
const MAX_CHANNEL_VALUE = 255;

/** Converts '#RRGGBB' hex string to GPU-ready [r, g, b] float triple (0..1) */
export function hexToRgb(hex: string): RgbFloat {
  if (hex.length !== HEX_COLOR_LENGTH || hex[0] !== '#') {
    throw new Error(`Invalid hex color: ${hex}. Expected format: #RRGGBB`);
  }

  const red = Number.parseInt(hex.slice(1, 3), HEX_RADIX) / MAX_CHANNEL_VALUE;
  const green = Number.parseInt(hex.slice(3, 5), HEX_RADIX) / MAX_CHANNEL_VALUE;
  const blue = Number.parseInt(hex.slice(5, 7), HEX_RADIX) / MAX_CHANNEL_VALUE;

  return [red, green, blue];
}

/**
 * Generates all subsets of the given modifiers, sorted by specificity
 * (fewer modifiers first). Within the same size, subsets are sorted
 * alphabetically by their joined key.
 */
function computeModifierSubsets(modifiers: readonly string[]): readonly string[][] {
  const sorted = [...modifiers].sort();
  const subsets: string[][] = [[]];

  for (const modifier of sorted) {
    const currentLength = subsets.length;
    for (let index = 0; index < currentLength; index++) {
      subsets.push([...subsets[index], modifier]);
    }
  }

  subsets.sort((subsetA, subsetB) => {
    if (subsetA.length !== subsetB.length) {
      return subsetA.length - subsetB.length;
    }
    return subsetA.join(':').localeCompare(subsetB.join(':'));
  });

  return subsets;
}

/**
 * Memoizes subset generation by the sorted-modifier key. The subset list depends
 * only on the *set* of modifiers (order-independent), so caching on the sorted
 * join collapses the `2^n` work to once per distinct modifier set. The cached
 * subsets are read-only and never mutated by callers.
 */
const modifierSubsetsCache = new Map<string, readonly string[][]>();

function generateModifierSubsets(modifiers: readonly string[]): readonly string[][] {
  const cacheKey = [...modifiers].sort().join(':');
  const cached = modifierSubsetsCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const subsets = computeModifierSubsets(modifiers);
  modifierSubsetsCache.set(cacheKey, subsets);
  return subsets;
}

function mergePartialStyle(
  base: ResolvedElementStyle,
  override: PartialElementStyle
): ResolvedElementStyle {
  return {
    color: override.color ?? base.color,
    width: override.width ?? base.width,
    size: override.size ?? base.size,
    alpha: override.alpha ?? base.alpha,
    line: override.line ?? base.line,
    markerType: override.markerType ?? base.markerType,
    strokeColor: override.strokeColor ?? base.strokeColor,
    strokeWidth: override.strokeWidth ?? base.strokeWidth,
  };
}

/**
 * Normalizes style map keys so that modifiers are in alphabetical order.
 * This allows style authors to write keys in any modifier order.
 */
function normalizeStyleKeys(
  styles: Readonly<Record<string, PartialElementStyle>>
): Readonly<Record<string, PartialElementStyle>> {
  const normalized: Record<string, PartialElementStyle> = {};

  for (const [key, value] of Object.entries(styles)) {
    const parts = key.split(':');
    if (parts.length <= 2) {
      normalized[key] = value;
      continue;
    }
    const element = parts[0];
    const modifiers = parts.slice(1).sort();
    normalized[`${element}:${modifiers.join(':')}`] = value;
  }

  return normalized;
}

/**
 * Per-style-map state computed once on first use: the normalized key map and a
 * memo of already-resolved cascades. Keyed on the `styles` object identity, so a
 * stable map (e.g. `STEREOMETRY_STYLES`) normalizes exactly once for the whole
 * session while distinct maps each get their own isolated entry.
 */
interface StyleMapCache {
  readonly normalizedStyles: Readonly<Record<string, PartialElementStyle>>;
  readonly resolvedByKey: Map<string, ResolvedElementStyle>;
}

const styleMapCaches = new WeakMap<Readonly<Record<string, PartialElementStyle>>, StyleMapCache>();

function getStyleMapCache(styles: Readonly<Record<string, PartialElementStyle>>): StyleMapCache {
  const existing = styleMapCaches.get(styles);
  if (existing !== undefined) {
    return existing;
  }
  const cache: StyleMapCache = {
    normalizedStyles: normalizeStyleKeys(styles),
    resolvedByKey: new Map(),
  };
  styleMapCaches.set(styles, cache);
  return cache;
}

function computeResolvedStyle(
  normalizedStyles: Readonly<Record<string, PartialElementStyle>>,
  element: string,
  modifiers: readonly string[]
): ResolvedElementStyle {
  const subsets = generateModifierSubsets(modifiers);

  let resolved = { ...DEFAULT_ELEMENT_STYLE };

  for (const subset of subsets) {
    const key = subset.length === 0 ? element : `${element}:${subset.join(':')}`;
    const partial = normalizedStyles[key];

    if (partial !== undefined) {
      resolved = mergePartialStyle(resolved, partial);
    }
  }

  return resolved;
}

/**
 * Resolves a style by cascading partial styles from least to most specific.
 *
 * For `resolveStyle(styles, 'segment', ['hidden', 'selected'])`, the merge order is:
 * 1. DEFAULT_ELEMENT_STYLE (all fields populated)
 * 2. styles['segment'] (base)
 * 3. styles['segment:hidden'] (1 modifier)
 * 4. styles['segment:selected'] (1 modifier)
 * 5. styles['segment:hidden:selected'] (2 modifiers, most specific)
 */
export function resolveStyle(
  styles: Readonly<Record<string, PartialElementStyle>>,
  element: string,
  modifiers: readonly string[]
): ResolvedElementStyle {
  const { normalizedStyles, resolvedByKey } = getStyleMapCache(styles);

  // The resolved cascade depends only on (normalized map, element, modifier set).
  // The modifier set is order-independent, so the sorted join is a complete key.
  const cacheKey = `${element}\0${[...modifiers].sort().join(':')}`;
  const cached = resolvedByKey.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const resolved = computeResolvedStyle(normalizedStyles, element, modifiers);
  resolvedByKey.set(cacheKey, resolved);
  return resolved;
}
