import { useFunction } from '@frozik/components/hooks/useFunction';
import { getIsHosted } from '@frozik/utils/isHosted';
import { isNil } from 'lodash-es';
import { Move, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useRegisterTopNavBack } from '../../../../app/components/TopNavBackContext';
import { WebGpuGuard } from '../../../../shared/components/WebGpuGuard';
import { runStereometry } from '../../application/render/draw';
import { useStereometryStore } from '../../application/useStereometryStore';
import type { PuzzleDefinition } from '../../domain/types';
import { TOOLBAR_ICON_SIZE } from '../constants';
import { stereometryT } from '../translations';
import { HelpPopover } from './HelpPopover';
import { PuzzlePopover } from './PuzzlePopover';
import { ToolbarButton } from './ToolbarButton';

const IS_HOSTED = getIsHosted();

export const StereometrySolver = observer(({ puzzle }: { puzzle: PuzzleDefinition }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useStereometryStore(puzzle.id);
  const navigate = useNavigate();

  const handleBackToPuzzles = useFunction(() => {
    void navigate('/stereometry');
  });
  useRegisterTopNavBack({
    label: stereometryT.nav.backToPuzzlesLabel,
    onActivate: handleBackToPuzzles,
  });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (isNil(canvas)) {
      return undefined;
    }

    const controls = runStereometry({
      canvas,
      puzzle,
      onHistoryChange: store.setHistoryAvailability,
      onFpsUpdate: store.setFps,
    });

    store.attach(controls);

    return () => {
      store.detach();
      controls.destroy();
    };
  }, [puzzle, store]);

  const handleSetRotateMode = useFunction(() => {
    store.setInteractionMode('rotate');
  });

  const handleSetPanMode = useFunction(() => {
    store.setInteractionMode('pan');
  });

  return (
    <WebGpuGuard className="h-full w-full">
      <div className="h-full w-full">
        <canvas ref={canvasRef} className="h-full w-full [touch-action:none]" />
        {!IS_HOSTED && (
          <div className="absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400">
            {store.fps} FPS
          </div>
        )}
        <div className="fixed right-4 bottom-4 flex gap-2">
          <PuzzlePopover puzzle={puzzle} />
          <HelpPopover />
          <ToolbarButton
            onClick={store.undo}
            label={stereometryT.toolbar.undo}
            disabled={!store.canUndo}
          >
            <Undo2 size={TOOLBAR_ICON_SIZE} />
          </ToolbarButton>
          <ToolbarButton
            onClick={store.redo}
            label={stereometryT.toolbar.redo}
            disabled={!store.canRedo}
          >
            <Redo2 size={TOOLBAR_ICON_SIZE} />
          </ToolbarButton>
          <ToolbarButton
            active={store.interactionMode === 'rotate'}
            onClick={handleSetRotateMode}
            label={stereometryT.toolbar.rotate}
          >
            <RotateCcw size={TOOLBAR_ICON_SIZE} />
          </ToolbarButton>
          <ToolbarButton
            active={store.interactionMode === 'pan'}
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
