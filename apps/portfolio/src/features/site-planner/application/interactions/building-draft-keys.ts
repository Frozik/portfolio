import { isNil } from 'lodash-es';

import { TYPED_LENGTH_KEY_PATTERN } from '../../domain/geometry/draw-constraints';
import type { SitePlannerStore } from '../SitePlannerStore';

/**
 * The keys a polyline in progress answers inside the building editor: Enter
 * lays the wall or the cable route being clicked out, Backspace peels the
 * last corner back, and — for a wall — digits and a separator are the CAD
 * value box that states the next segment's length. True when the key was
 * spent on a draft.
 */
export function handleDraftKey(store: SitePlannerStore, key: string): boolean {
  const { wallDraft } = store;
  const { wiring } = store.electrics;

  if (wiring.draftRoutePoints.length > 0) {
    if (key === 'Enter') {
      wiring.commitDraftRoute();

      return true;
    }

    if (key === 'Backspace') {
      wiring.dropLastDraftRoutePoint();

      return true;
    }
  }

  if (wallDraft.draftWallPoints.length === 0) {
    return false;
  }

  if (key === 'Enter') {
    wallDraft.commitDraftWall();

    return true;
  }

  if (TYPED_LENGTH_KEY_PATTERN.test(key)) {
    wallDraft.appendTypedLengthKey(key);

    return true;
  }

  if (key === 'Backspace') {
    if (isNil(wallDraft.typedLengthText)) {
      wallDraft.dropLastDraftWallPoint();
    } else {
      wallDraft.setTypedLengthText(undefined);
    }

    return true;
  }

  return false;
}
