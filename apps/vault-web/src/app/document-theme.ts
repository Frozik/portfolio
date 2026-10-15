import type { ISchemePair } from '@frozik/components/tokens/color-roles';
import { autorun } from 'mobx';

import type { AppearanceModel } from '@frozik/vault-app/device/application/AppearanceModel';

/**
 * Keeps `<html data-theme>` and the browser chrome's `theme-color` on the
 * user's choice after the pre-paint script set them once; at `system` each
 * meta goes back to the scheme its media query names.
 */
export function followDocumentTheme(
  appearance: AppearanceModel,
  background: ISchemePair
): () => void {
  return autorun(() => {
    const { preference } = appearance;
    document.documentElement.dataset.theme = preference;
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
      const scheme =
        preference === 'system' ? (meta.media.includes('dark') ? 'dark' : 'light') : preference;
      meta.content = background[scheme];
    });
  });
}
