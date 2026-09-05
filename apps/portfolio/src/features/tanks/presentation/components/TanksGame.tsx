import { useFunction } from '@frozik/components/hooks/useFunction';
import { useIsCoarsePointer } from '@frozik/components/hooks/useIsCoarsePointer';
import { useKeyboardAction } from '@frozik/components/hooks/useKeyboardAction';
import { useWakeLock } from '@frozik/components/hooks/useWakeLock';
import { getIsHosted } from '@frozik/utils/isHosted';
import { isNil } from 'lodash-es';
import { Pause } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';

import { Button } from '../../../../shared/ui/Button';
import type { ITanksSimulationHost } from '../../application/render/tanks-draw';
import { runTanks } from '../../application/render/tanks-draw';
import { TanksAudioController } from '../../application/TanksAudioController';
import { useTanksStore } from '../../application/useTanksStore';
import { mergePlayerInputs } from '../../domain/merge-player-inputs';
import type { IInputSource } from '../../domain/ports/input-source';
import { HUD_ICON_SIZE_PX } from '../constants';
import { useStageCurtain } from '../hooks/useStageCurtain';
import { tanksT } from '../translations';
import { GameOverOverlay } from './GameOverOverlay';
import { PauseOverlay } from './PauseOverlay';
import { StageClearOverlay } from './StageClearOverlay';
import { StageIntro } from './StageIntro';
import { StartMenuOverlay } from './StartMenuOverlay';
import { TanksHud } from './TanksHud';
import { TouchControls } from './TouchControls';

const IS_HOSTED = getIsHosted();

/**
 * Owns the renderer and the audio controller — the store holds data only (§12). Strict-mode
 * double-mount is safe: every piece created here is disposed in the effect cleanup.
 */
export const TanksGame = observer(
  ({ createKeyboardSource }: { readonly createKeyboardSource: () => IInputSource }) => {
    const store = useTanksStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioControllerRef = useRef<TanksAudioController | undefined>(undefined);
    const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
    const { gameStatus, isPlaying, fps } = store;
    const isCoarsePointer = useIsCoarsePointer();
    const stageCurtain = useStageCurtain(gameStatus === 'stage-intro');

    useEffect(() => {
      const canvas = canvasRef.current;

      if (isNil(canvas)) {
        return undefined;
      }

      const audioController = new TanksAudioController(store);
      const keyboardSource = createKeyboardSource();
      const host: ITanksSimulationHost = {
        isSimulating: () => store.isPlaying,
        areEffectsRunning: () => store.gameStatus === 'stage-clear',
        readInputs: () => mergePlayerInputs(keyboardSource.read(), store.touchInput.read()),
        onTick: (inputs, events) => {
          store.applyWorldEvents(events);
          audioController.onTick(inputs, events);
        },
      };

      audioControllerRef.current = audioController;
      const stopRenderer = runTanks({
        canvas,
        worldRef: store.worldRef,
        host,
        onFpsUpdate: IS_HOSTED ? undefined : store.setFps,
      });

      return () => {
        stopRenderer();
        keyboardSource.dispose();
        audioController.dispose();
        audioControllerRef.current = undefined;
      };
    }, [store, createKeyboardSource]);

    useEffect(() => {
      if (!isPlaying) {
        return undefined;
      }

      void requestWakeLock();

      return () => {
        void releaseWakeLock();
      };
    }, [isPlaying, requestWakeLock, releaseWakeLock]);

    /** Enter and Escape mean "move the flow along" wherever the player currently is. */
    const handleFlowKey = useFunction(() => {
      switch (store.gameStatus) {
        case 'menu':
          store.startGame();
          break;
        case 'stage-intro':
          store.skipStageIntro();
          break;
        case 'game-over':
          store.returnToMenu();
          break;
        default:
          store.togglePause();
      }
    });

    const handleFireKey = useFunction(() => {
      store.skipStageIntro();
    });

    const handlePauseClick = useFunction(() => {
      store.togglePause();
    });

    /** The first touch of the canvas is as good a gesture as any to start the audio with. */
    const handleCanvasPointerDown = useFunction(() => {
      audioControllerRef.current?.unlock();
    });

    useKeyboardAction('Enter', handleFlowKey);
    useKeyboardAction('Escape', handleFlowKey);
    useKeyboardAction('Space', handleFireKey);

    return (
      <div className="flex h-full w-full flex-col landscape:flex-row">
        <TanksHud />
        {/* overflow-hidden: an overlay past the edge would scrollbar the main and resize the canvas */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            className="h-full w-full [touch-action:none]"
          />

          {gameStatus === 'menu' ? <StartMenuOverlay /> : null}
          {stageCurtain.isMounted ? <StageIntro isOpening={stageCurtain.isOpening} /> : null}
          {gameStatus === 'paused' ? <PauseOverlay /> : null}
          {gameStatus === 'stage-clear' ? <StageClearOverlay /> : null}
          {gameStatus === 'game-over' ? <GameOverOverlay /> : null}

          {isCoarsePointer && isPlaying ? <TouchControls /> : null}
          {isCoarsePointer && isPlaying ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={tanksT.pause}
              onClick={handlePauseClick}
              className="absolute top-2 right-2 z-10 text-white/50"
            >
              <Pause size={HUD_ICON_SIZE_PX} aria-hidden="true" />
            </Button>
          ) : null}

          {IS_HOSTED ? null : (
            <div className="absolute top-3 left-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400">
              {fps} FPS
            </div>
          )}
        </div>
      </div>
    );
  }
);
