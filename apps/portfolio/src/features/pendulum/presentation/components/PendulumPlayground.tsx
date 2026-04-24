import { useFunction } from '@frozik/components/hooks/useFunction';
import { useKeyboardAction } from '@frozik/components/hooks/useKeyboardAction';
import { useMouseAction } from '@frozik/components/hooks/useMouseAction';
import { isNil } from 'lodash-es';
import { PauseCircle, PlayCircle } from 'lucide-react';
import type React from 'react';
import type { ReactNode } from 'react';
import { memo, useRef } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { Renderer } from '../../../../shared/components/Renderer';
import { Button } from '../../../../shared/ui/Button';
import { Slider } from '../../../../shared/ui/Slider';
import styles from './PendulumPlayground.module.scss';

const PAUSE_ICON_SIZE = 48;
const BUTTON_ICON_SIZE = 18;

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

    useMouseAction(
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
      <div ref={ref} className={styles.container} tabIndex={-1}>
        <Renderer
          className={styles.containerParentFill}
          width={width}
          height={height}
          onCanvasContext={onSetContexts}
        />
        {paused && (
          <div className={styles.containerParentFill}>
            <PlayCircle
              className={styles.containerPaused}
              size={PAUSE_ICON_SIZE}
              onClick={togglePaused}
            />
          </div>
        )}
        <Button className={styles.worldPauseAction} variant="secondary" onClick={togglePaused}>
          {paused ? (
            <PlayCircle size={BUTTON_ICON_SIZE} />
          ) : (
            <PauseCircle size={BUTTON_ICON_SIZE} />
          )}
        </Button>
        <Slider
          className={styles.worldGravity}
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
