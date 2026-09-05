import { memo, useEffect, useRef, useState } from 'react';
import { useAmbientCanvas } from '../../../../../shared/hooks/useAmbientCanvas';
import type { TProjectFxKind } from './fx/types';
import { createProjectFxAnimation } from './project-fx-animation';

const MAX_DPR = 1;
const IDLE_FPS = 30;
const HOVERED_FPS = 60;

const ProjectFxComponent = ({
  kind,
  hovered,
}: {
  readonly kind: TProjectFxKind;
  readonly hovered: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animation] = useState(() => createProjectFxAnimation(kind));

  useEffect(() => {
    animation.setHovered(hovered);
  }, [animation, hovered]);

  useAmbientCanvas(canvasRef, {
    ...animation,
    maxDpr: MAX_DPR,
    targetFps: hovered ? HOVERED_FPS : IDLE_FPS,
    allocateWhenVisible: true,
  });

  return (
    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />
  );
};

export const ProjectFx = memo(ProjectFxComponent);
