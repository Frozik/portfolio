import type { GlassesAssetUrls } from '../domain/glasses-style';
import roundGlassesUrl from './assets/glasses.svg?url';
import hippieGlassesUrl from './assets/hippie-glasses.svg?url';
import teacherGlassesUrl from './assets/teacher-glasses.svg?url';

/**
 * One SVG per glasses style. All share the 240-wide viewBox and lens-centre
 * convention `computeGlassesTransform` relies on. Used by the picker's
 * previews and handed to the media composer for the video overlay.
 */
export const GLASSES_ASSET_URLS: GlassesAssetUrls = {
  round: roundGlassesUrl,
  hippie: hippieGlassesUrl,
  teacher: teacherGlassesUrl,
};
