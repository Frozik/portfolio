import { debounce } from 'lodash-es';

import { HASH_WRITE_DELAY_MS } from '../domain/constants';
import type { MapView } from '../domain/map-view';
import { formatViewHash, parseViewHash } from '../domain/view-hash';

export interface ViewHashSync {
  /** The view the page opened with, when the hash carried one. */
  readonly initialView: MapView | undefined;
  /** Writes the view into the hash once the camera has been quiet for a moment. */
  publish(view: MapView): void;
  dispose(): void;
}

/** Mirrors the camera into `location.hash` so a link reproduces the view; the router never sees it. */
export function createViewHashSync(): ViewHashSync {
  const publish = debounce((view: MapView) => {
    window.history.replaceState(null, '', `#${formatViewHash(view)}`);
  }, HASH_WRITE_DELAY_MS);

  return {
    initialView: parseViewHash(window.location.hash),
    publish,
    dispose(): void {
      // Cancel rather than flush: on unmount the URL already belongs to the next route.
      publish.cancel();
    },
  };
}
