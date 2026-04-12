import { useFunction } from '@frozik/components';
import * as Popover from '@radix-ui/react-popover';
import { Info, Move, RotateCcw, X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { cn } from '../../../shared/lib/cn';
import commonStyles from '../../../shared/styles.module.scss';
import type { OrbitalCameraController } from '../domain/stereometry-camera-controller';
import { runStereometry } from '../domain/stereometry-draw';
import type { CameraInteractionMode } from '../domain/stereometry-types';

const TOOLBAR_ICON_SIZE = 20;
const TOOLBAR_BUTTON_SIZE = 40;
const CLOSE_ICON_SIZE = 14;

export const Stereometry = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<OrbitalCameraController | null>(null);
  const [interactionMode, setInteractionMode] = useState<CameraInteractionMode>('rotate');

  useEffect(() => {
    if (canvasRef.current) {
      const { destroy, camera } = runStereometry(canvasRef.current);
      cameraRef.current = camera;

      return () => {
        cameraRef.current = null;
        destroy();
      };
    }

    return undefined;
  }, []);

  const handleSetRotateMode = useFunction(() => {
    setInteractionMode('rotate');
    cameraRef.current?.setInteractionMode('rotate');
  });

  const handleSetPanMode = useFunction(() => {
    setInteractionMode('pan');
    cameraRef.current?.setInteractionMode('pan');
  });

  return (
    <WebGpuGuard className={commonStyles.fixedContainer}>
      <div className={commonStyles.fixedContainer}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        <div className="absolute bottom-4 right-4 flex gap-2">
          <HelpPopover />
          <ToolbarButton
            active={interactionMode === 'rotate'}
            onClick={handleSetRotateMode}
            label="Rotate"
          >
            <RotateCcw size={TOOLBAR_ICON_SIZE} />
          </ToolbarButton>
          <ToolbarButton active={interactionMode === 'pan'} onClick={handleSetPanMode} label="Pan">
            <Move size={TOOLBAR_ICON_SIZE} />
          </ToolbarButton>
        </div>
      </div>
    </WebGpuGuard>
  );
});

const ToolbarButton = memo(
  ({
    active,
    onClick,
    children,
    label,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    label: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex items-center justify-center rounded-lg shadow-lg',
        'transition-all hover:scale-110 active:scale-95',
        active ? 'bg-blue-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
      )}
      style={{ width: TOOLBAR_BUTTON_SIZE, height: TOOLBAR_BUTTON_SIZE }}
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
          aria-label="Help"
          className={cn(
            'flex items-center justify-center rounded-lg shadow-lg',
            'transition-all hover:scale-110 active:scale-95',
            isOpen
              ? 'bg-blue-500 text-white scale-110'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          )}
          style={{ width: TOOLBAR_BUTTON_SIZE, height: TOOLBAR_BUTTON_SIZE }}
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
            <span className="font-semibold text-white">Stereometry</span>
            <Popover.Close
              aria-label="Close"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <X size={CLOSE_ICON_SIZE} />
            </Popover.Close>
          </div>
          <p className="mb-3 text-neutral-400">
            Interactive 3D geometry tool for exploring a pentagonal pyramid.
          </p>
          <ul className="space-y-1.5 text-neutral-300">
            <li>
              <strong className="text-neutral-100">Drag</strong> — rotate the camera
            </li>
            <li>
              <strong className="text-neutral-100">Shift+Drag</strong> — pan the view
            </li>
            <li>
              <strong className="text-neutral-100">Scroll / Pinch</strong> — zoom in and out
            </li>
            <li>
              <strong className="text-neutral-100">Click edge</strong> — select an edge
            </li>
            <li>
              <strong className="text-neutral-100">Double-click edge</strong> — extend edge into an
              infinite line
            </li>
            <li>
              <strong className="text-neutral-100">Drag vertex → vertex</strong> — draw a
              construction line between two points
            </li>
          </ul>
          <p className="mt-3 text-xs text-neutral-500">
            Intersection points appear automatically where lines cross.
          </p>
          <Popover.Arrow className="fill-neutral-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
