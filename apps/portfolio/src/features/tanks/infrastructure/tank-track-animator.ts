import { isNil } from 'lodash-es';

import { TRACK_ADVANCE_DISTANCE_WU } from './render-constants';
import { TANK_TRACK_FRAME_COUNT } from './sprites/tank-bitmaps';

interface TrackState {
  positionX: number;
  positionY: number;
  frameIndex: number;
  /** Distance travelled that has not yet been cashed in for a frame flip. */
  pendingDistanceWu: number;
}

/**
 * Tracks advance per world unit travelled, not on a timer. The domain never says
 * "I moved" — axis-aligned whole-unit steps make the Manhattan position delta the distance.
 */
export class TankTrackAnimator {
  private readonly states = new Map<string, TrackState>();

  resolveFrameIndex(key: string, positionX: number, positionY: number): number {
    const state = this.states.get(key);

    if (isNil(state)) {
      this.states.set(key, { positionX, positionY, frameIndex: 0, pendingDistanceWu: 0 });

      return 0;
    }

    state.pendingDistanceWu +=
      Math.abs(positionX - state.positionX) + Math.abs(positionY - state.positionY);
    state.positionX = positionX;
    state.positionY = positionY;

    const advanceCount = Math.floor(state.pendingDistanceWu / TRACK_ADVANCE_DISTANCE_WU);

    state.pendingDistanceWu -= advanceCount * TRACK_ADVANCE_DISTANCE_WU;
    state.frameIndex = (state.frameIndex + advanceCount) % TANK_TRACK_FRAME_COUNT;

    return state.frameIndex;
  }
}
