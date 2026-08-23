import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { useTanksStore } from '../../application/useTanksStore';
import type { Direction } from '../../domain/types';
import {
  TOUCH_ANCHOR_BOTTOM_CLASS,
  TOUCH_ANCHOR_LEFT_CLASS,
  TOUCH_ANCHOR_RIGHT_CLASS,
  TOUCH_DPAD_SIZE_CLASS,
  TOUCH_DPAD_VIEWBOX_SIZE,
  TOUCH_FIRE_SIZE_CLASS,
  TOUCH_GLYPH_OPACITY_CLASS,
  TOUCH_SURFACE_ACTIVE_CLASS,
  TOUCH_SURFACE_IDLE_CLASS,
  TOUCH_SURFACE_TRANSITION_CLASS,
  TOUCH_ZONE_ACTIVE_FILL_CLASS,
  TOUCH_ZONE_IDLE_FILL_CLASS,
  TOUCH_ZONE_STROKE_CLASS,
  TOUCH_ZONE_TRANSITION_CLASS,
} from '../constants';
import { resolveDpadDirection } from '../dpad-geometry';
import { tanksT } from '../translations';

interface DpadZone {
  readonly direction: Direction;
  /** Triangle from two corners of the square to its centre — the "rays to the corners" split. */
  readonly trianglePoints: string;
  readonly chevronPoints: string;
}

const DPAD_ZONES: readonly DpadZone[] = [
  { direction: 'up', trianglePoints: '0,0 100,0 50,50', chevronPoints: '38,24 50,12 62,24' },
  { direction: 'right', trianglePoints: '100,0 100,100 50,50', chevronPoints: '76,38 88,50 76,62' },
  { direction: 'down', trianglePoints: '0,100 100,100 50,50', chevronPoints: '38,76 50,88 62,76' },
  { direction: 'left', trianglePoints: '0,0 0,100 50,50', chevronPoints: '24,38 12,50 24,62' },
];

const CONTAINER_BASE_CLASS =
  'pointer-events-auto absolute select-none rounded-2xl border border-white/15 ' +
  'backdrop-blur-sm [touch-action:none]';

const DPAD_VIEWBOX = `0 0 ${TOUCH_DPAD_VIEWBOX_SIZE} ${TOUCH_DPAD_VIEWBOX_SIZE}`;

/** Lives outside the WebGPU canvas — costs nothing per frame and cannot desync from it (§12.2). */
export const TouchControls = memo(() => {
  const store = useTanksStore();
  const dpadPointerIdRef = useRef<number | undefined>(undefined);
  const firePointerIdRef = useRef<number | undefined>(undefined);
  const [activeDirection, setActiveDirection] = useState<Direction | undefined>(undefined);
  const [isFireActive, setIsFireActive] = useState(false);

  // A finger still down when the overlay unmounts would leave the tank driving forever.
  useEffect(() => {
    const { touchControls } = store;

    return () => touchControls.release();
  }, [store]);

  const steerFromPointer = useFunction((event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const direction = resolveDpadDirection(
      event.clientX - (bounds.left + bounds.width / 2),
      event.clientY - (bounds.top + bounds.height / 2)
    );

    setActiveDirection(direction);
    store.touchControls.setDirection(direction);
  });

  const handleDpadPointerDown = useFunction((event: ReactPointerEvent<HTMLDivElement>) => {
    // A second finger landing on the pad is ignored so steering never fights itself.
    if (!isNil(dpadPointerIdRef.current)) {
      return;
    }

    dpadPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    steerFromPointer(event);
  });

  const handleDpadPointerMove = useFunction((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dpadPointerIdRef.current !== event.pointerId) {
      return;
    }

    steerFromPointer(event);
  });

  const handleDpadPointerEnd = useFunction((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dpadPointerIdRef.current !== event.pointerId) {
      return;
    }

    dpadPointerIdRef.current = undefined;
    setActiveDirection(undefined);
    store.touchControls.setDirection(undefined);
  });

  const handleFirePointerDown = useFunction((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isNil(firePointerIdRef.current)) {
      return;
    }

    firePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsFireActive(true);
    store.touchControls.setFire(true);
  });

  const handleFirePointerEnd = useFunction((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (firePointerIdRef.current !== event.pointerId) {
      return;
    }

    firePointerIdRef.current = undefined;
    setIsFireActive(false);
    store.touchControls.setFire(false);
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Pointer-only chrome: the four zones cannot be operated by assistive tech, and arrow
          keys steer on every device, so announcing an inoperable widget would only add noise. */}
      <div
        aria-hidden="true"
        onPointerDown={handleDpadPointerDown}
        onPointerMove={handleDpadPointerMove}
        onPointerUp={handleDpadPointerEnd}
        onPointerCancel={handleDpadPointerEnd}
        className={cn(
          CONTAINER_BASE_CLASS,
          TOUCH_DPAD_SIZE_CLASS,
          TOUCH_ANCHOR_BOTTOM_CLASS,
          TOUCH_ANCHOR_RIGHT_CLASS
        )}
      >
        <svg viewBox={DPAD_VIEWBOX} aria-hidden="true" className="size-full">
          {DPAD_ZONES.map(zone => (
            <g key={zone.direction}>
              <polygon
                points={zone.trianglePoints}
                className={cn(
                  TOUCH_ZONE_TRANSITION_CLASS,
                  TOUCH_ZONE_STROKE_CLASS,
                  activeDirection === zone.direction
                    ? TOUCH_ZONE_ACTIVE_FILL_CLASS
                    : TOUCH_ZONE_IDLE_FILL_CLASS
                )}
              />
              <polyline
                points={zone.chevronPoints}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn('fill-none stroke-white stroke-[3]', TOUCH_GLYPH_OPACITY_CLASS)}
              />
            </g>
          ))}
        </svg>
      </div>

      <button
        type="button"
        aria-label={tanksT.touch.fire}
        onPointerDown={handleFirePointerDown}
        onPointerUp={handleFirePointerEnd}
        onPointerCancel={handleFirePointerEnd}
        className={cn(
          CONTAINER_BASE_CLASS,
          TOUCH_FIRE_SIZE_CLASS,
          TOUCH_ANCHOR_BOTTOM_CLASS,
          TOUCH_ANCHOR_LEFT_CLASS,
          TOUCH_SURFACE_TRANSITION_CLASS,
          isFireActive ? TOUCH_SURFACE_ACTIVE_CLASS : TOUCH_SURFACE_IDLE_CLASS
        )}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" className="size-full p-4">
          <g
            className={cn('fill-none stroke-white stroke-[3]', TOUCH_GLYPH_OPACITY_CLASS)}
            strokeLinecap="round"
          >
            <circle cx="24" cy="24" r="13" />
            <path d="M24 2v10M24 36v10M2 24h10M36 24h10" />
          </g>
        </svg>
      </button>
    </div>
  );
});
