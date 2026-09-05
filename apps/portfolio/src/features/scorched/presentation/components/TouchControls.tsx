import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { memo, useEffect, useRef, useState } from 'react';

import type { IPointerAimInput } from '../../application/pointer-aim-source';
import { useScorchedStore } from '../../application/useScorchedStore';
import { getWeapon } from '../../domain/weapons/catalog';
import {
  HUD_ICON_SIZE_PX,
  STEPPER_INITIAL_REPEAT_MS,
  STEPPER_REPEAT_INTERVAL_MS,
  TOUCH_ANCHOR_BOTTOM_CLASS,
  TOUCH_ANCHOR_LEFT_CLASS,
  TOUCH_ANCHOR_RIGHT_CLASS,
  TOUCH_FIRE_SIZE_CLASS,
  TOUCH_GLYPH_OPACITY_CLASS,
  TOUCH_STEPPER_SIZE_CLASS,
  TOUCH_SURFACE_ACTIVE_CLASS,
  TOUCH_SURFACE_IDLE_CLASS,
  TOUCH_SURFACE_TRANSITION_CLASS,
  UNLIMITED_COUNT_LABEL,
} from '../constants';
import { scorchedT } from '../translations';
import { getWeaponName } from '../weapon-names';
import { ShopGlyph } from './ShopGlyph';

const DIAL_STEP_DEGREES = 1;
const POWER_STEP = 1;
const NO_AMMUNITION = 0;

const CONTAINER_BASE_CLASS =
  'pointer-events-auto absolute select-none rounded-2xl border border-white/15 ' +
  'backdrop-blur-sm [touch-action:none]';

/** A fine-tune stepper: one step on press, then a burst after a short delay. */
const Stepper = memo(
  ({
    label,
    glyphPoints,
    dialDelta,
    powerDelta,
    pointerInput,
    className,
  }: {
    readonly label: string;
    readonly glyphPoints: string;
    readonly dialDelta: number;
    readonly powerDelta: number;
    readonly pointerInput: IPointerAimInput;
    readonly className?: string;
  }) => {
    const [isActive, setIsActive] = useState(false);
    const pointerIdRef = useRef<number | undefined>(undefined);
    const initialTimeoutRef = useRef<number | undefined>(undefined);
    const intervalRef = useRef<number | undefined>(undefined);

    const stopRepeat = useFunction(() => {
      window.clearTimeout(initialTimeoutRef.current);
      window.clearInterval(intervalRef.current);
      initialTimeoutRef.current = undefined;
      intervalRef.current = undefined;
    });

    // A finger still down when the overlay unmounts would nudge the barrel forever.
    useEffect(() => stopRepeat, [stopRepeat]);

    const handlePointerDown = useFunction((event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isNil(pointerIdRef.current)) {
        return;
      }

      pointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsActive(true);
      pointerInput.nudge(dialDelta, powerDelta);

      initialTimeoutRef.current = window.setTimeout(() => {
        intervalRef.current = window.setInterval(
          () => pointerInput.nudge(dialDelta, powerDelta),
          STEPPER_REPEAT_INTERVAL_MS
        );
      }, STEPPER_INITIAL_REPEAT_MS);
    });

    const handlePointerEnd = useFunction((event: ReactPointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== event.pointerId) {
        return;
      }

      pointerIdRef.current = undefined;
      setIsActive(false);
      stopRepeat();
    });

    return (
      <button
        type="button"
        aria-label={label}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={cn(
          CONTAINER_BASE_CLASS,
          'relative',
          TOUCH_STEPPER_SIZE_CLASS,
          TOUCH_SURFACE_TRANSITION_CLASS,
          isActive ? TOUCH_SURFACE_ACTIVE_CLASS : TOUCH_SURFACE_IDLE_CLASS,
          className
        )}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" className="size-full p-3">
          <polyline
            points={glyphPoints}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('fill-none stroke-white stroke-[4]', TOUCH_GLYPH_OPACITY_CLASS)}
          />
        </svg>
      </button>
    );
  }
);

/**
 * The mobile control chrome: two fine-tune stepper columns in the bottom corners and a
 * prominent fire button in the middle carrying the selected weapon's badge. Coarse aiming is the
 * drag gesture on the field itself, which the canvas owns — these are the last degree of precision.
 */
export const TouchControls = observer(
  ({ pointerInput }: { readonly pointerInput: IPointerAimInput }) => {
    const store = useScorchedStore();
    const { selectedWeaponId } = store.aim;
    const firePointerIdRef = useRef<number | undefined>(undefined);
    const [isFireActive, setIsFireActive] = useState(false);
    // The badge carries what the fire button is about to send: family glyph, name and how
    // many are left — infinite for the baby missile, which is the whole point of it.
    const selectedCount =
      store.aim.availableWeapons.find(entry => entry.weaponId === selectedWeaponId)?.count ??
      NO_AMMUNITION;

    useEffect(() => () => pointerInput.release(), [pointerInput]);

    const handleFirePointerDown = useFunction((event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isNil(firePointerIdRef.current)) {
        return;
      }

      firePointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsFireActive(true);
    });

    const releaseFirePointer = useFunction((event: ReactPointerEvent<HTMLButtonElement>) => {
      if (firePointerIdRef.current !== event.pointerId) {
        return false;
      }

      firePointerIdRef.current = undefined;
      setIsFireActive(false);

      return true;
    });

    const handleFirePointerUp = useFunction((event: ReactPointerEvent<HTMLButtonElement>) => {
      if (releaseFirePointer(event)) {
        pointerInput.requestFire();
      }
    });

    /**
     * A cancelled pointer is the system taking the touch away — a palm, a notification, a gesture
     * the browser claimed. The finger never came off the button, so the shot must not go off.
     */
    const handleFirePointerCancel = useFunction((event: ReactPointerEvent<HTMLButtonElement>) => {
      releaseFirePointer(event);
    });

    const handleBadgeClick = useFunction(() => {
      store.aim.setCarouselOpen(true);
    });

    return (
      <div className="pointer-events-none absolute inset-0 z-10">
        <div
          className={cn(
            'pointer-events-none absolute flex gap-2',
            TOUCH_ANCHOR_BOTTOM_CLASS,
            TOUCH_ANCHOR_LEFT_CLASS
          )}
        >
          <Stepper
            label={scorchedT.touch.angleDown}
            glyphPoints="16,18 28,24 16,30"
            dialDelta={-DIAL_STEP_DEGREES}
            powerDelta={0}
            pointerInput={pointerInput}
            className="static"
          />
          <Stepper
            label={scorchedT.touch.angleUp}
            glyphPoints="32,18 20,24 32,30"
            dialDelta={DIAL_STEP_DEGREES}
            powerDelta={0}
            pointerInput={pointerInput}
            className="static"
          />
        </div>

        <div
          className={cn(
            'pointer-events-none absolute flex gap-2',
            TOUCH_ANCHOR_BOTTOM_CLASS,
            TOUCH_ANCHOR_RIGHT_CLASS
          )}
        >
          <Stepper
            label={scorchedT.touch.powerDown}
            glyphPoints="18,30 24,18 30,30"
            dialDelta={0}
            powerDelta={-POWER_STEP}
            pointerInput={pointerInput}
            className="static rotate-180"
          />
          <Stepper
            label={scorchedT.touch.powerUp}
            glyphPoints="18,30 24,18 30,30"
            dialDelta={0}
            powerDelta={POWER_STEP}
            pointerInput={pointerInput}
            className="static"
          />
        </div>

        <div
          className={cn(
            'pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1',
            TOUCH_ANCHOR_BOTTOM_CLASS
          )}
        >
          <button
            type="button"
            onClick={handleBadgeClick}
            disabled={!store.isAiming || store.isAiTurn}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur-sm disabled:opacity-50"
          >
            <ShopGlyph glyphId={getWeapon(selectedWeaponId).family} sizePx={HUD_ICON_SIZE_PX} />
            {getWeaponName(selectedWeaponId)}
            <span className="font-mono tabular-nums text-white/50">
              {Number.isFinite(selectedCount) ? selectedCount : UNLIMITED_COUNT_LABEL}
            </span>
          </button>

          <button
            type="button"
            aria-label={scorchedT.touch.fire}
            disabled={!store.isAiming}
            onPointerDown={handleFirePointerDown}
            onPointerUp={handleFirePointerUp}
            onPointerCancel={handleFirePointerCancel}
            className={cn(
              CONTAINER_BASE_CLASS,
              'static disabled:opacity-30',
              TOUCH_FIRE_SIZE_CLASS,
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

          <span className="pointer-events-none text-[0.625rem] text-white/40">
            {scorchedT.touch.aimHint}
          </span>
        </div>
      </div>
    );
  }
);
