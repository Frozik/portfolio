import { useFunction } from '@frozik/components/hooks/useFunction';
import { useKeyboardAction } from '@frozik/components/hooks/useKeyboardAction';
import { usePointerAction } from '@frozik/components/hooks/usePointerAction';
import { isNil } from 'lodash-es';
import { PauseCircle, PlayCircle } from 'lucide-react';
import type React from 'react';
import type { ReactNode } from 'react';
import { memo, useRef } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { Renderer } from '../../../../shared/components/Renderer';
import { Button } from '../../../../shared/ui/Button';
import { Slider } from '../../../../shared/ui/Slider';

const PAUSE_ICON_SIZE = 48;
const BUTTON_ICON_SIZE = 18;

const FILL_PARENT_CLASS = 'absolute inset-0 flex items-center justify-center overflow-hidden';

const PAUSED_ICON_CLASS =
  'cursor-pointer rounded-full bg-[#1677ff] p-0.5 text-[60px] text-[#e6f7ff] hover:p-2';

export const PendulumPlayground = memo(
  ({
    paused,
    gravity,
    pauseResumeKeyCode,
    onGravityChanged,
    onPausedChanged,
    onSetContexts,
    onAdditionalForce,
    children,
  }: {
    paused: boolean;
    gravity: number;
    pauseResumeKeyCode?: string;
    onGravityChanged: (gravity: number) => void;
    onPausedChanged: (paused: boolean) => void;
    onSetContexts: (contexts: {
      staticContext: CanvasRenderingContext2D;
      context: CanvasRenderingContext2D;
    }) => void;
    onAdditionalForce?: (position?: { x: number; y: number }) => void;
    children?: ReactNode;
  }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { width = 0, height = 0 } = useResizeObserver({
      ref: ref as React.RefObject<HTMLElement>,
      box: 'border-box',
    });

    const togglePaused = useFunction(() => onPausedChanged(!paused));

    useKeyboardAction(pauseResumeKeyCode, togglePaused, ref);

    usePointerAction(
      useFunction(({ x, y, buttons }) => {
        if ((buttons & (2 ** 0)) === 0) {
          onAdditionalForce?.();
        } else {
          onAdditionalForce?.({ x: x - width / 2, y: y - height / 2 });
        }
      }),
      isNil(onAdditionalForce) ? undefined : ref
    );

    return (
      <div
        ref={ref}
        className="relative h-full w-full touch-none border border-transparent focus-within:border-[#1d39c4]"
        tabIndex={-1}
      >
        <Renderer
          className={FILL_PARENT_CLASS}
          width={width}
          height={height}
          onCanvasContext={onSetContexts}
        />
        {paused && (
          <div className={FILL_PARENT_CLASS}>
            <PlayCircle
              className={PAUSED_ICON_CLASS}
              size={PAUSE_ICON_SIZE}
              onClick={togglePaused}
            />
          </div>
        )}
        <Button
          className="absolute right-4 bottom-4 z-[1]"
          variant="secondary"
          onClick={togglePaused}
        >
          {paused ? (
            <PlayCircle size={BUTTON_ICON_SIZE} />
          ) : (
            <PauseCircle size={BUTTON_ICON_SIZE} />
          )}
        </Button>
        <Slider
          className="absolute top-[100px] right-4 bottom-[74px] z-[1] h-auto"
          value={gravity}
          vertical
          onChange={onGravityChanged}
          min={0.1}
          step={0.1}
          max={2}
        />
        {children}
      </div>
    );
  }
);
