import { cn } from '@frozik/components/components/cn';
import { useKeyboardAction } from '@frozik/components/hooks/useKeyboardAction';
import { usePointerAction } from '@frozik/components/hooks/usePointerAction';
import { isNil } from 'lodash-es';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PointerEvent, ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useEventCallback, useResizeObserver } from 'usehooks-ts';

import { Button } from '../../../../shared/ui/Button';
import { Slider } from '../../../../shared/ui/Slider';
import type { PlaygroundSession } from '../../application/PlaygroundSession';
import type { IPoint } from '../../domain/types';
import { createCanvasRenderer } from '../render/canvas-renderer';
import { toScenePoint } from '../render/scene-viewport';

const PAUSE_ICON_SIZE = 48;
const BUTTON_ICON_SIZE = 18;
const PRIMARY_POINTER_BUTTON_MASK = 1;

const MIN_GRAVITY = 0.1;
const MAX_GRAVITY = 2;
const GRAVITY_STEP = 0.1;

const FILL_PARENT_CLASS = 'absolute inset-0 flex items-center justify-center overflow-hidden';
const CANVAS_CLASS = 'absolute inset-0 h-full w-full';

const PAUSED_ICON_CLASS =
  'pointer-events-auto cursor-pointer rounded-full bg-[#1677ff] p-0.5 text-[60px] text-[#e6f7ff] hover:p-2';

export const PendulumPlayground = observer(
  ({
    session,
    pauseResumeKeyCode,
    onScenePress,
    onSceneClick,
    sceneClassName,
    children,
  }: {
    readonly session: PlaygroundSession;
    readonly pauseResumeKeyCode?: string;
    /** The scene point under the held primary pointer, `undefined` once it is released. */
    readonly onScenePress?: (point: IPoint | undefined) => void;
    readonly onSceneClick?: VoidFunction;
    readonly sceneClassName?: string;
    readonly children?: ReactNode;
  }) => {
    const ref = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<HTMLDivElement>(null);
    const staticCanvasRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { width = 0, height = 0 } = useResizeObserver({
      ref: sceneRef as RefObject<HTMLElement>,
      box: 'border-box',
    });
    const pixelRatio = window.devicePixelRatio;
    const canvasWidth = Math.round(width * pixelRatio);
    const canvasHeight = Math.round(height * pixelRatio);

    useEffect(() => {
      const staticContext = staticCanvasRef.current?.getContext('2d', { alpha: false });
      const context = canvasRef.current?.getContext('2d', { alpha: true });
      if (isNil(staticContext) || isNil(context)) {
        return;
      }

      // Resizing a canvas clears it, and a paused session paints nothing on
      // its own: re-attaching on every size change repaints the scene.
      session.attachRenderer(createCanvasRenderer({ staticContext, context, pixelRatio }));
      return () => session.attachRenderer(undefined);
    }, [session, pixelRatio, canvasWidth, canvasHeight]);

    useKeyboardAction(pauseResumeKeyCode, session.togglePaused, ref);

    usePointerAction(
      useEventCallback(({ x, y, buttons }) => {
        const pressed = (buttons & PRIMARY_POINTER_BUTTON_MASK) !== 0;
        onScenePress?.(pressed ? toScenePoint({ x, y }, width, height) : undefined);
      }),
      isNil(onScenePress) ? undefined : sceneRef
    );

    // Without the capture a press dragged out of the scene never reports its release.
    const handlePointerDown = useEventCallback((event: PointerEvent<HTMLDivElement>) => {
      if (!isNil(onScenePress)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    });

    return (
      <div
        ref={ref}
        className="relative h-full w-full touch-none border border-transparent focus-within:border-[#1d39c4]"
        tabIndex={-1}
      >
        <div
          ref={sceneRef}
          className={cn(FILL_PARENT_CLASS, sceneClassName)}
          onPointerDown={handlePointerDown}
          onClick={onSceneClick}
        >
          <canvas
            className={CANVAS_CLASS}
            ref={staticCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
          />
          <canvas
            className={CANVAS_CLASS}
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
          />
        </div>
        {session.paused && (
          <div className={cn(FILL_PARENT_CLASS, 'pointer-events-none')}>
            <PlayCircle
              className={PAUSED_ICON_CLASS}
              size={PAUSE_ICON_SIZE}
              onClick={session.togglePaused}
            />
          </div>
        )}
        <Button
          className="absolute right-4 bottom-4 z-[1] pointer-coarse:hidden"
          variant="secondary"
          onClick={session.togglePaused}
        >
          {session.paused ? (
            <PlayCircle size={BUTTON_ICON_SIZE} />
          ) : (
            <PauseCircle size={BUTTON_ICON_SIZE} />
          )}
        </Button>
        <Slider
          className="absolute top-[100px] right-4 bottom-[74px] z-[1] h-auto pointer-coarse:hidden"
          value={session.gravity}
          vertical
          onChange={session.setGravity}
          min={MIN_GRAVITY}
          step={GRAVITY_STEP}
          max={MAX_GRAVITY}
        />
        {children}
      </div>
    );
  }
);
