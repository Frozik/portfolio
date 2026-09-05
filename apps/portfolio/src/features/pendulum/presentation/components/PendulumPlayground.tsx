import { useFunction } from '@frozik/components/hooks/useFunction';
import { useKeyboardAction } from '@frozik/components/hooks/useKeyboardAction';
import { usePointerAction } from '@frozik/components/hooks/usePointerAction';
import { isNil } from 'lodash-es';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useResizeObserver } from 'usehooks-ts';

import { Button } from '../../../../shared/ui/Button';
import { Slider } from '../../../../shared/ui/Slider';
import type { PlaygroundSession } from '../../application/PlaygroundSession';
import { createCanvasRenderer } from '../render/canvas-renderer';

const PAUSE_ICON_SIZE = 48;
const BUTTON_ICON_SIZE = 18;
const PRIMARY_POINTER_BUTTON_MASK = 1;

const MIN_GRAVITY = 0.1;
const MAX_GRAVITY = 2;
const GRAVITY_STEP = 0.1;

const FILL_PARENT_CLASS = 'absolute inset-0 flex items-center justify-center overflow-hidden';
const CANVAS_CLASS = 'absolute inset-0';

const PAUSED_ICON_CLASS =
  'cursor-pointer rounded-full bg-[#1677ff] p-0.5 text-[60px] text-[#e6f7ff] hover:p-2';

export const PendulumPlayground = observer(
  ({
    session,
    pauseResumeKeyCode,
    pointerForce = false,
    children,
  }: {
    readonly session: PlaygroundSession;
    readonly pauseResumeKeyCode?: string;
    /** Lets the primary pointer button push the bobs away. */
    readonly pointerForce?: boolean;
    readonly children?: ReactNode;
  }) => {
    const ref = useRef<HTMLDivElement>(null);
    const staticCanvasRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { width = 0, height = 0 } = useResizeObserver({
      ref: ref as RefObject<HTMLElement>,
      box: 'border-box',
    });

    useEffect(() => {
      const staticContext = staticCanvasRef.current?.getContext('2d', { alpha: false });
      const context = canvasRef.current?.getContext('2d', { alpha: true });
      if (isNil(staticContext) || isNil(context)) {
        return;
      }

      session.attachRenderer(createCanvasRenderer({ staticContext, context }));
      return () => session.attachRenderer(undefined);
    }, [session]);

    useKeyboardAction(pauseResumeKeyCode, session.togglePaused, ref);

    usePointerAction(
      useFunction(({ x, y, buttons }) => {
        const pressed = (buttons & PRIMARY_POINTER_BUTTON_MASK) !== 0;
        session.setPointerForce(pressed ? { x: x - width / 2, y: y - height / 2 } : undefined);
      }),
      pointerForce ? ref : undefined
    );

    return (
      <div
        ref={ref}
        className="relative h-full w-full touch-none border border-transparent focus-within:border-[#1d39c4]"
        tabIndex={-1}
      >
        <div className={FILL_PARENT_CLASS}>
          <canvas className={CANVAS_CLASS} ref={staticCanvasRef} width={width} height={height} />
          <canvas className={CANVAS_CLASS} ref={canvasRef} width={width} height={height} />
        </div>
        {session.paused && (
          <div className={FILL_PARENT_CLASS}>
            <PlayCircle
              className={PAUSED_ICON_CLASS}
              size={PAUSE_ICON_SIZE}
              onClick={session.togglePaused}
            />
          </div>
        )}
        <Button
          className="absolute right-4 bottom-4 z-[1]"
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
          className="absolute top-[100px] right-4 bottom-[74px] z-[1] h-auto"
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
