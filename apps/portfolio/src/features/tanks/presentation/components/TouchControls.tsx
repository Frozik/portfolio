import { cn } from '@frozik/components/components/cn';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';
import { useTanksStore } from '../../application/useTanksStore';
import {
  TOUCH_ANCHOR_BOTTOM_CLASS,
  TOUCH_ANCHOR_LEFT_CLASS,
  TOUCH_ANCHOR_RIGHT_CLASS,
  TOUCH_HINT_OPACITY_CLASS,
} from '../constants';
import type { JoystickState } from '../floating-joystick';
import { getKnobOffset, plantJoystick, tiltJoystick } from '../floating-joystick';
import type { TouchZoneSize } from '../touch-zone';
import { clampToZone } from '../touch-zone';
import { tanksT } from '../translations';
import { FireGlyph } from './FireGlyph';
import { JoystickGlyph } from './JoystickGlyph';

const UNDER_THE_FINGER_CLASS = 'absolute -translate-x-1/2 -translate-y-1/2';

const ZONE_BASE_CLASS =
  'pointer-events-auto absolute inset-y-0 w-1/2 select-none [touch-action:none] ' +
  '[-webkit-touch-callout:none]';

function readZonePointer(event: ReactPointerEvent<HTMLElement>): {
  readonly point: Vector2;
  readonly zone: TouchZoneSize;
} {
  const bounds = event.currentTarget.getBoundingClientRect();

  return {
    point: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
    zone: { width: bounds.width, height: bounds.height },
  };
}

/** Lives outside the WebGPU canvas — costs nothing per frame and cannot desync from it. */
export const TouchControls = memo(() => {
  const store = useTanksStore();
  const steeringPointerIdRef = useRef<number | undefined>(undefined);
  // Moves can outpace renders; the ref is what the next move builds on, the state what is drawn.
  const joystickRef = useRef<JoystickState | undefined>(undefined);
  const firingPointerIdsRef = useRef(new Set<number>());
  const leadFiringPointerIdRef = useRef<number | undefined>(undefined);
  const [joystick, setJoystick] = useState<JoystickState | undefined>(undefined);
  /** Where the fire button rides; set for as long as the gun is held. */
  const [firePoint, setFirePoint] = useState<Vector2 | undefined>(undefined);

  // A finger still down when the overlay unmounts would leave the tank driving forever.
  useEffect(() => {
    const { touchControls } = store;

    return () => touchControls.release();
  }, [store]);

  const steer = useEventCallback((next: JoystickState | undefined) => {
    joystickRef.current = next;
    setJoystick(next);
    store.touchControls.setDirection(next?.direction);
  });

  const handleSteerPointerDown = useEventCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    // A second finger landing on the zone is ignored so steering never fights itself.
    if (!isNil(steeringPointerIdRef.current)) {
      return;
    }

    steeringPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    steer(plantJoystick(readZonePointer(event).point));
  });

  const handleSteerPointerMove = useEventCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (steeringPointerIdRef.current !== event.pointerId || isNil(joystickRef.current)) {
      return;
    }

    const { point, zone } = readZonePointer(event);

    steer(tiltJoystick(joystickRef.current, point, zone));
  });

  const handleSteerPointerEnd = useEventCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (steeringPointerIdRef.current !== event.pointerId) {
      return;
    }

    steeringPointerIdRef.current = undefined;
    steer(undefined);
  });

  // The button rides the finger that landed last.
  const handleFirePointerDown = useEventCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    firingPointerIdsRef.current.add(event.pointerId);
    leadFiringPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFirePoint(readZonePointer(event).point);
    store.touchControls.setFire(true);
  });

  const handleFirePointerMove = useEventCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (leadFiringPointerIdRef.current === event.pointerId) {
      const { point, zone } = readZonePointer(event);

      setFirePoint(clampToZone(point, zone));
    }
  });

  // The gun stays held until the last finger leaves the zone.
  const handleFirePointerEnd = useEventCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    firingPointerIdsRef.current.delete(event.pointerId);

    if (leadFiringPointerIdRef.current === event.pointerId) {
      leadFiringPointerIdRef.current = undefined;
    }
    if (firingPointerIdsRef.current.size > 0) {
      return;
    }

    setFirePoint(undefined);
    store.touchControls.setFire(false);
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <button
        type="button"
        aria-label={tanksT.touch.fire}
        onPointerDown={handleFirePointerDown}
        onPointerMove={handleFirePointerMove}
        onPointerUp={handleFirePointerEnd}
        onPointerCancel={handleFirePointerEnd}
        className={cn(ZONE_BASE_CLASS, 'left-0 cursor-default outline-none')}
      >
        {isNil(firePoint) ? (
          <FireGlyph
            className={cn(
              'absolute',
              TOUCH_HINT_OPACITY_CLASS,
              TOUCH_ANCHOR_BOTTOM_CLASS,
              TOUCH_ANCHOR_LEFT_CLASS
            )}
          />
        ) : (
          <span
            className={UNDER_THE_FINGER_CLASS}
            // The button rides the finger, so its position exists only at runtime.
            style={{ left: firePoint.x, top: firePoint.y }}
          >
            <FireGlyph isActive />
          </span>
        )}
      </button>

      {/* Pointer-only chrome: the stick cannot be operated by assistive tech, and arrow keys
          steer on every device, so announcing an inoperable widget would only add noise. */}
      <div
        aria-hidden="true"
        onPointerDown={handleSteerPointerDown}
        onPointerMove={handleSteerPointerMove}
        onPointerUp={handleSteerPointerEnd}
        onPointerCancel={handleSteerPointerEnd}
        className={cn(ZONE_BASE_CLASS, 'right-0')}
      >
        {isNil(joystick) ? (
          <JoystickGlyph
            className={cn(
              'absolute',
              TOUCH_HINT_OPACITY_CLASS,
              TOUCH_ANCHOR_BOTTOM_CLASS,
              TOUCH_ANCHOR_RIGHT_CLASS
            )}
          />
        ) : (
          <div
            className={UNDER_THE_FINGER_CLASS}
            // The stick stands wherever the thumb landed, so its position exists only at runtime.
            style={{ left: joystick.center.x, top: joystick.center.y }}
          >
            <JoystickGlyph direction={joystick.direction} thumbOffset={getKnobOffset(joystick)} />
          </div>
        )}
      </div>
    </div>
  );
});
