/**
 * Visual variant selected for the AR glasses overlay drawn into the
 * outgoing video stream. `'none'` disables the entire AR pipeline —
 * the composer reverts to passthrough rendering and skips face
 * detection altogether.
 *
 * Each non-`'none'` style maps 1:1 to an SVG asset under
 * `presentation/assets/`. All assets share the same `viewBox`
 * (240x80) and lens-center convention (cx=70 / cx=170, cy=40) so
 * `computeGlassesTransform` is style-agnostic.
 */
export type TGlassesStyle = 'none' | 'round' | 'hippie' | 'teacher';

/** Asset URL per drawn style, supplied by the presentation layer that owns the SVGs. */
export type GlassesAssetUrls = Readonly<Record<Exclude<TGlassesStyle, 'none'>, string>>;

/** Style applied when a participant first joins a room. */
export const DEFAULT_GLASSES_STYLE: TGlassesStyle = 'round';

/** All styles in the order they should appear in the picker UI. */
export const GLASSES_STYLES: readonly TGlassesStyle[] = ['round', 'hippie', 'teacher', 'none'];
