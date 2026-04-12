import { useFunction } from '@frozik/components';
import { Move, RotateCcw } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { cn } from '../../../shared/lib/cn';
import commonStyles from '../../../shared/styles.module.scss';
import type { OrbitalCameraController } from '../domain/stereometry-camera-controller';
import { runStereometry } from '../domain/stereometry-draw';
import type { CameraInteractionMode } from '../domain/stereometry-types';

const TOOLBAR_ICON_SIZE = 20;
const TOOLBAR_BUTTON_SIZE = 40;

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
