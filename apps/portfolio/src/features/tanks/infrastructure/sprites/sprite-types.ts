/** Pixel value that leaves the atlas texel fully transparent. */
export const TRANSPARENT_PIXEL = '.';

/** Rows of single-character palette keys, e.g. `'..1122..'`; `.` is transparent. */
export type SpriteBitmap = readonly string[];

/** Maps the palette keys used by a bitmap to `#RRGGBB` colors of the NES hardware palette. */
export type SpritePalette = Readonly<Record<string, string>>;

export interface SpriteDefinition {
  readonly bitmap: SpriteBitmap;
  readonly palette: SpritePalette;
  /** Animation frames packed side by side inside `bitmap` (1 for a still sprite). */
  readonly frameCount: number;
}

export type SpriteCatalog = ReadonlyMap<string, SpriteDefinition>;
