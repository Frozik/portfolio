export type TRgb = readonly [number, number, number];

const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX_RADIX = 16;

const tokenCache = new Map<string, TRgb>();

export function parseHexRgb(raw: string): TRgb | undefined {
  const match = raw.trim().match(HEX_COLOR_PATTERN);
  if (match === null) {
    return undefined;
  }
  return [
    Number.parseInt(match[1], HEX_RADIX),
    Number.parseInt(match[2], HEX_RADIX),
    Number.parseInt(match[3], HEX_RADIX),
  ];
}

/**
 * Reads a `#rrggbb` design token (`--color-…`) from the document root. Tokens
 * are static, so each is resolved once per page: a landing page holds a dozen
 * ambient canvases, and a style resolve from every one of them on every resize
 * showed up as forced style/layout work on load.
 */
export function readCssRgbToken(token: string, fallback: TRgb): TRgb {
  const cached = tokenCache.get(token);
  if (cached !== undefined) {
    return cached;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
  const value = parseHexRgb(raw) ?? fallback;
  tokenCache.set(token, value);
  return value;
}
