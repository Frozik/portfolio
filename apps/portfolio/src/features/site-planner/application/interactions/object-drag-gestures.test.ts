import type { Vector2 } from '@frozik/utils/math/vector2';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ISitePlanRepository } from '../../domain/persistence/ISitePlanRepository';
import { NO_MODIFIERS } from '../../domain/view/plan-input';
import { SitePlannerStore } from '../SitePlannerStore';
import type { DraggedObject } from './object-drag-gestures';
import { ObjectDragGestures } from './object-drag-gestures';

const NO_STORAGE: ISitePlanRepository = {
  loadPlan: () => Promise.resolve({ kind: 'empty' as const }),
  savePlan: () => Promise.resolve(),
};

const ORIGIN: Vector2 = { x: 0, y: 0 };
const START_ROTATION_DEGREES = 30;
/** Two metres due north of the origin: the bearing here is 90°. */
const GRAB_POINT: Vector2 = { x: 0, y: 2 };

/** The grab point swept another `degrees` counter-clockwise about the origin. */
function sweptFromGrab(degrees: number): Vector2 {
  const bearingRadians = ((90 + degrees) * Math.PI) / 180;

  return { x: 2 * Math.cos(bearingRadians), y: 2 * Math.sin(bearingRadians) };
}

describe('turning a grabbed object', () => {
  let store: SitePlannerStore;
  let gestures: ObjectDragGestures;
  let turns: number[];
  let object: DraggedObject;

  beforeEach(() => {
    store = new SitePlannerStore(NO_STORAGE);
    gestures = new ObjectDragGestures({
      store,
      getViewport: () => ({
        centerMeters: { x: 0, y: 0 },
        pixelsPerMeter: 10,
        widthPx: 400,
        heightPx: 400,
      }),
      hasPointerMoved: () => true,
    });
    turns = [];
    object = {
      origin: ORIGIN,
      startRotationDegrees: START_ROTATION_DEGREES,
      moveTo: () => undefined,
      turnTo: rotationDegrees => {
        turns.push(rotationDegrees);
      },
      restore: () => undefined,
    };
  });

  it('holds the facing still while the pointer has not swept: no jump at the grab', () => {
    // The regression: assigning the pointer's absolute bearing made the piece
    // snap into line with the grip the moment it was taken — a 90° leap for
    // every north-framed object, since bearings are measured from east.
    gestures.beginRotate(object, GRAB_POINT);
    gestures.move(GRAB_POINT, NO_MODIFIERS);

    expect(turns).toEqual([START_ROTATION_DEGREES]);
  });

  it('adds the swept angle onto the facing the piece was grabbed with', () => {
    gestures.beginRotate(object, GRAB_POINT);
    gestures.move(sweptFromGrab(40), NO_MODIFIERS);

    expect(turns.at(-1)).toBeCloseTo(START_ROTATION_DEGREES + 40);
  });

  it('snaps the sweep, not the absolute heading, under Shift', () => {
    gestures.beginRotate(object, GRAB_POINT);
    gestures.move(sweptFromGrab(40), { isAltPressed: false, isShiftPressed: true });

    expect(turns.at(-1)).toBeCloseTo(START_ROTATION_DEGREES + 45);
  });
});
