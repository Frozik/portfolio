import { useFunction } from '@frozik/components/hooks/useFunction';
import { getIsHosted } from '@frozik/utils/isHosted';
import { Move, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useRegisterTopNavBack } from '../../../../app/components/TopNavBackContext';
import { WebGpuGuard } from '../../../../shared/components/WebGpuGuard';
import type { StereometryControls } from '../../application/render/draw';
import { runStereometry } from '../../application/render/draw';
import type { CameraInteractionMode, PuzzleDefinition } from '../../domain/types';
import { TOOLBAR_ICON_SIZE } from '../constants';
import { stereometryT } from '../translations';
import { HelpPopover } from './HelpPopover';
import { PuzzlePopover } from './PuzzlePopover';
import { ToolbarButton } from './ToolbarButton';

const IS_HOSTED = getIsHosted();

export const StereometrySolver = memo(({ puzzle }: { puzzle: PuzzleDefinition }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<StereometryControls | null>(null);
  const [interactionMode, setInteractionMode] = useState<CameraInteractionMode>('rotate');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [fps, setFps] = useState(0);
  const navigate = useNavigate();

  const handleBackToPuzzles = useFunction(() => {
    void navigate('/stereometry');
  });
  useRegisterTopNavBack({
    label: stereometryT.nav.backToPuzzlesLabel,
    onActivate: handleBackToPuzzles,
  });

  useEffect(() => {
    if (canvasRef.current) {
      const controls = runStereometry(canvasRef.current, puzzle);
      controlsRef.current = controls;

      const unsubscribeHistory = controls.subscribeHistory((undoAvailable, redoAvailable) => {
        setCanUndo(undoAvailable);
        setCanRedo(redoAvailable);
      });

      const unsubscribeFps = controls.subscribeFps(setFps);

      return () => {
        controlsRef.current = null;
        unsubscribeHistory();
        unsubscribeFps();
        controls.destroy();
      };
    }

    return undefined;
  }, [puzzle]);

  const handleSetRotateMode = useFunction(() => {
    setInteractionMode('rotate');
    controlsRef.current?.camera.setInteractionMode('rotate');
  });

  const handleSetPanMode = useFunction(() => {
    setInteractionMode('pan');
    controlsRef.current?.camera.setInteractionMode('pan');
  });

  const handleUndo = useFunction(() => {
    controlsRef.current?.undo();
  });

  const handleRedo = useFunction(() => {
    controlsRef.current?.redo();
  });

  return (
    <WebGpuGuard className="h-full w-full">
      <div className="h-full w-full">
        <canvas ref={canvasRef} className="h-full w-full [touch-action:none]" />
        {!IS_HOSTED && (
          <div className="absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400">
            {fps} FPS
          </div>
        )}
        <div className="fixed right-4 bottom-4 flex gap-2">
          <PuzzlePopover puzzle={puzzle} />
          <HelpPopover />
          <ToolbarButton onClick={handleUndo} label={stereometryT.toolbar.undo} disabled={!canUndo}>
            <Undo2 size={TOOLBAR_ICON_SIZE} />
          </ToolbarButton>
          <ToolbarButton onClick={handleRedo} label={stereometryT.toolbar.redo} disabled={!canRedo}>
            <Redo2 size={TOOLBAR_ICON_SIZE} />
          </ToolbarButton>
          <ToolbarButton
            active={interactionMode === 'rotate'}
            onClick={handleSetRotateMode}
            label={stereometryT.toolbar.rotate}
          >
            <RotateCcw size={TOOLBAR_ICON_SIZE} />
          </ToolbarButton>
          <ToolbarButton
            active={interactionMode === 'pan'}
            onClick={handleSetPanMode}
            label={stereometryT.toolbar.pan}
          >
            <Move size={TOOLBAR_ICON_SIZE} />
          </ToolbarButton>
        </div>
      </div>
    </WebGpuGuard>
  );
});
