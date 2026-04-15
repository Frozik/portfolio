import { useFunction } from '@frozik/components';
import { getIsHosted } from '@frozik/utils';
import * as Popover from '@radix-ui/react-popover';
import { Info, Move, Redo2, RotateCcw, Undo2, X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';

const IS_HOSTED = getIsHosted();

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { cn } from '../../../shared/lib/cn';
import commonStyles from '../../../shared/styles.module.scss';
import type { StereometryControls } from '../domain/draw';
import { runStereometry } from '../domain/draw';
import type { CameraInteractionMode } from '../domain/types';
import { stereometryT } from './translations';

const TOOLBAR_ICON_SIZE = 20;
const CLOSE_ICON_SIZE = 14;

export const Stereometry = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<StereometryControls | null>(null);
  const [interactionMode, setInteractionMode] = useState<CameraInteractionMode>('rotate');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (canvasRef.current) {
      const controls = runStereometry(canvasRef.current);
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
  }, []);

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
    <WebGpuGuard className={commonStyles.fixedContainer}>
      <div className={commonStyles.fixedContainer}>
        <canvas ref={canvasRef} className="h-full w-full [touch-action:none]" />
        {!IS_HOSTED && (
          <div className="absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400">
            {fps} FPS
          </div>
        )}
        <div className="fixed right-4 bottom-4 flex gap-2">
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

const ToolbarButton = memo(
  ({
    active = false,
    disabled = false,
    onClick,
    children,
    label,
  }: {
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    label: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex size-10 items-center justify-center rounded-lg shadow-lg',
        'transition-all',
        disabled
          ? 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
          : 'hover:scale-110 active:scale-95',
        !disabled && active && 'bg-blue-500 text-white',
        !disabled && !active && 'bg-neutral-800 text-neutral-400 hover:text-white'
      )}
    >
      {children}
    </button>
  )
);

const HelpPopover = memo(() => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={stereometryT.toolbar.help}
          className={cn(
            'flex size-10 items-center justify-center rounded-lg shadow-lg',
            'transition-all hover:scale-110 active:scale-95',
            isOpen
              ? 'bg-blue-500 text-white scale-110'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          )}
        >
          <Info size={TOOLBAR_ICON_SIZE} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          align="end"
          className={cn(
            'z-50 w-72 rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl',
            'border border-neutral-700',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-white">{stereometryT.help.title}</span>
            <Popover.Close
              aria-label={stereometryT.toolbar.close}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <X size={CLOSE_ICON_SIZE} />
            </Popover.Close>
          </div>
          <p className="mb-3 text-neutral-400">{stereometryT.help.description}</p>
          <ul className="space-y-1.5 text-neutral-300">
            <li>
              <strong className="text-neutral-100">{stereometryT.help.controlLabels.drag}</strong> —{' '}
              {stereometryT.help.controls.drag}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.shiftDrag}
              </strong>{' '}
              — {stereometryT.help.controls.shiftDrag}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.scrollPinch}
              </strong>{' '}
              — {stereometryT.help.controls.scrollPinch}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.clickEdge}
              </strong>{' '}
              — {stereometryT.help.controls.clickEdge}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.doubleClickEdge}
              </strong>{' '}
              — {stereometryT.help.controls.doubleClickEdge}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.doubleClickLine}
              </strong>{' '}
              — {stereometryT.help.controls.doubleClickLine}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.dragVertex}
              </strong>{' '}
              — {stereometryT.help.controls.dragVertex}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.selectEdgeTapVertex}
              </strong>{' '}
              — {stereometryT.help.controls.selectEdgeTapVertex}
            </li>
          </ul>
          <p className="mt-3 text-xs text-neutral-500">{stereometryT.help.intersectionHint}</p>
          <Popover.Arrow className="fill-neutral-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
