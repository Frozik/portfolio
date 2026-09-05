import { useFunction } from '@frozik/components/hooks/useFunction';
import { useIsCoarsePointer } from '@frozik/components/hooks/useIsCoarsePointer';
import { useWakeLock } from '@frozik/components/hooks/useWakeLock';
import { getIsHosted } from '@frozik/utils/isHosted';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef } from 'react';

import { AimGhost } from '../../application/aim-ghost';
import { PointerAimSource } from '../../application/pointer-aim-source';
import type { IScorchedSimulationHost } from '../../application/render/scorched-draw';
import { runScorched } from '../../application/render/scorched-draw';
import { ScorchedAudioController } from '../../application/ScorchedAudioController';
import { useScorchedStore } from '../../application/useScorchedStore';
import type { IScorchedInputSource } from '../../domain/scorched-input';
import { mergeScorchedInputs } from '../../domain/scorched-input';
import { pickRandomSkyPreset } from '../../domain/sky-presets';
import { useDragAim } from '../hooks/useDragAim';
import { useFieldTransform } from '../hooks/useFieldTransform';
import { FieldOverlays } from './FieldOverlays';
import { HandoverOverlay } from './HandoverOverlay';
import { MatchResultOverlay } from './MatchResultOverlay';
import { RosterScreen } from './RosterScreen';
import { RoundResultOverlay } from './RoundResultOverlay';
import { ScorchedHud } from './ScorchedHud';
import { ShopScreen } from './ShopScreen';
import { ShotSetupBar } from './ShotSetupBar';
import { TouchControls } from './TouchControls';
import { TurnActionsBar } from './TurnActionsBar';
import { WeaponCarousel } from './WeaponCarousel';

const IS_HOSTED = getIsHosted();
const NO_DESCENT_SPEED = 0;

/**
 * The route's playable shell: the WebGPU canvas, the HUD strip, the flow overlays and the
 * virtual controls.
 *
 * This component owns the renderer, the input sources and the audio controller: the store
 * holds data only, so the side-effectful pieces live and die with the canvas element. Strict-mode
 * double-mount is safe — `runScorched` tolerates teardown before its async GPU init lands, and
 * everything created here is disposed in the effect cleanup.
 */
export const ScorchedGame = observer(
  ({ createKeyAimSource }: { readonly createKeyAimSource: () => IScorchedInputSource }) => {
    const store = useScorchedStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioControllerRef = useRef<ScorchedAudioController | undefined>(undefined);
    const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
    const { status, isTicking, fps } = store;
    const skyPreset = useMemo(() => pickRandomSkyPreset(), []);
    const aimGhost = useMemo(() => new AimGhost(), []);
    const pointerSource = useMemo(() => new PointerAimSource(), []);
    const isCoarsePointer = useIsCoarsePointer();
    const transform = useFieldTransform(canvasRef);

    useEffect(() => {
      const canvas = canvasRef.current;

      if (isNil(canvas)) {
        return undefined;
      }

      const audioController = new ScorchedAudioController(store);
      const keyAimSource = createKeyAimSource();
      /**
       * How fast the fastest descending shell is travelling, so the whistle can be pitched by it.
       * Zero while nothing is on its way down, which is what the cue triggers on.
       */
      const readDescentSpeed = (): number =>
        store.roundRef.current.projectiles.reduce((fastest, projectile) => {
          const { x: velocityX, y: velocityY } = projectile.state.velocity;
          const isDescending = velocityY < 0;

          return isDescending ? Math.max(fastest, Math.hypot(velocityX, velocityY)) : fastest;
        }, NO_DESCENT_SPEED);
      const host: IScorchedSimulationHost = {
        isTicking: () => store.isTicking,
        readInput: () => mergeScorchedInputs(keyAimSource.read(), pointerSource.read()),
        advanceFrame: elapsedSeconds => store.advanceFrame(elapsedSeconds),
        applyInput: input => store.applyInput(input),
        tick: () => store.tick(),
      };

      audioControllerRef.current = audioController;

      const stopRenderer = runScorched({
        canvas,
        roundRef: store.roundRef,
        host,
        skyPreset,
        aimGhost,
        onEvents: events => audioController.onFrame(events, readDescentSpeed()),
        onFpsUpdate: IS_HOSTED ? undefined : store.setFps,
      });

      return () => {
        stopRenderer();
        keyAimSource.dispose();
        pointerSource.dispose();
        audioController.dispose();
        audioControllerRef.current = undefined;
      };
    }, [store, skyPreset, aimGhost, pointerSource, createKeyAimSource]);

    useEffect(() => {
      if (!isTicking) {
        return undefined;
      }

      void requestWakeLock();

      return () => {
        void releaseWakeLock();
      };
    }, [isTicking, requestWakeLock, releaseWakeLock]);

    const dragHandlers = useDragAim({
      transform,
      pointerInput: pointerSource,
      aimGhost,
      getOrigin: () => {
        const playerId = store.activePlayerId;

        return isNil(playerId) ? undefined : store.roundRef.current.getTank(playerId);
      },
      getMaxPower: () => store.maxPower,
      isEnabled: store.isAiming && !store.isAiTurn,
    });

    /** The first touch of the canvas is as good a gesture as any to start the audio with. */
    const handleCanvasPointerDown = useFunction(
      (event: Parameters<typeof dragHandlers.onPointerDown>[0]) => {
        audioControllerRef.current?.unlock();
        dragHandlers.onPointerDown(event);
      }
    );

    /** The till rings from the screen that spends the money; the controller lives here. */
    const handlePurchase = useFunction(() => {
      audioControllerRef.current?.playPurchase();
    });

    const isPlaying = status === 'playing';

    return (
      <div className="flex h-full w-full flex-col">
        <ScorchedHud />

        {/* overflow-hidden: an overlay past the edge would scrollbar the main and resize the canvas */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={dragHandlers.onPointerMove}
            onPointerUp={dragHandlers.onPointerUp}
            onPointerCancel={dragHandlers.onPointerCancel}
            className="h-full w-full [touch-action:none]"
          />

          <FieldOverlays transform={transform} />

          {isPlaying ? <ShotSetupBar /> : null}
          {isPlaying ? <TurnActionsBar /> : null}
          {isPlaying && isCoarsePointer ? <TouchControls pointerInput={pointerSource} /> : null}
          {isPlaying && store.isWeaponCarouselOpen ? <WeaponCarousel /> : null}

          {status === 'setup' ? <RosterScreen /> : null}
          {status === 'handover' ? <HandoverOverlay /> : null}
          {status === 'round-over' ? <RoundResultOverlay /> : null}
          {status === 'shop' ? <ShopScreen onPurchase={handlePurchase} /> : null}
          {status === 'match-over' ? <MatchResultOverlay /> : null}

          {IS_HOSTED ? null : (
            <div className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400">
              {fps} FPS
            </div>
          )}
        </div>
      </div>
    );
  }
);
