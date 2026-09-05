import { useFunction } from '@frozik/components/hooks/useFunction';
import { useIsCoarsePointer } from '@frozik/components/hooks/useIsCoarsePointer';
import { useKeyboardAction } from '@frozik/components/hooks/useKeyboardAction';
import { useWakeLock } from '@frozik/components/hooks/useWakeLock';
import { getIsHosted } from '@frozik/utils/isHosted';
import { isNil } from 'lodash-es';
import { Pause } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';

import { WebGpuUnsupportedNotice } from '../../../../shared/components/WebGpuUnsupportedNotice';
import { Button } from '../../../../shared/ui/Button';
import { runTanks } from '../../application/render/tanks-draw';
import { createTanksSession } from '../../application/tanks-session';
import { TanksAudioController } from '../../application/TanksAudioController';
import { useTanksStore } from '../../application/useTanksStore';
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
 * Owns the renderer and the audio controller — the store holds data only. Strict-mode
 * double-mount is safe: every piece created here is disposed in the effect cleanup.
 */
export const TanksGame = observer(
  ({ createKeyboardSource }: { readonly createKeyboardSource: () => IInputSource }) => {
    const store = useTanksStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioControllerRef = useRef<TanksAudioController | undefined>(undefined);
    const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
    const { gameStatus, isPlaying, fps, rendererFailure } = store;
    const isCoarsePointer = useIsCoarsePointer();
    const stageCurtain = useStageCurtain(gameStatus === 'stage-intro');

    useEffect(() => {
      const canvas = canvasRef.current;

      if (isNil(canvas)) {
        return undefined;
      }

      const audioController = new TanksAudioController(store);
      const keyboardSource = createKeyboardSource();

      audioControllerRef.current = audioController;
      const stopRenderer = runTanks({
        canvas,
        worldRef: store.worldRef,
        host: createTanksSession({ store, audio: audioController, keyboard: keyboardSource }),
        onFpsUpdate: IS_HOSTED ? undefined : store.setFps,
        onInitError: store.failRenderer,
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

    if (!isNil(rendererFailure)) {
      return (
        <div className="flex h-full w-full flex-col items-center gap-4 overflow-y-auto py-6">
          <WebGpuUnsupportedNotice />
          <p className="font-mono text-xs text-text-muted">
            {tanksT.rendererFailed}: {rendererFailure}
          </p>
        </div>
      );
    }

    return (
      <div className="flex h-full w-full flex-col landscape:flex-row">
        <TanksHud />
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
