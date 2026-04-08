import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '../../../../shared/lib/cn';

const MIN_SHOW_DELAY_MS = 3_000;
const MAX_SHOW_DELAY_MS = 5_000;
const VISIBLE_DURATION_MS = 4_000;
const FADE_DURATION_MS = 400;
const BLINK_INTERVAL_MS = 2_500;
const BLINK_DURATION_MS = 150;
const PUPIL_MOVE_INTERVAL_MS = 1_200;
const MAX_PUPIL_OFFSET = 3;

const EYE_RX = 22;
const EYE_RY = 26;
const LID_OVERLAP = 1;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function Eye({
  cx,
  cy,
  pupilOffsetX,
  pupilOffsetY,
  blinkProgress,
  browPath,
  eyeId,
  scale = 1,
}: {
  cx: number;
  cy: number;
  pupilOffsetX: number;
  pupilOffsetY: number;
  blinkProgress: number;
  browPath: string;
  eyeId: string;
  scale?: number;
}) {
  const lidY = -EYE_RY + blinkProgress * (EYE_RY * 2);

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      <defs>
        <clipPath id={eyeId}>
          <ellipse cx="0" cy="0" rx={EYE_RX} ry={EYE_RY} />
        </clipPath>
      </defs>

      <ellipse
        cx="0"
        cy="0"
        rx={EYE_RX}
        ry={EYE_RY}
        fill="white"
        stroke="#2a2a2a"
        strokeWidth="2"
      />

      <circle cx={pupilOffsetX} cy={pupilOffsetY + 4} r="9" fill="#3b5998" />
      <circle cx={pupilOffsetX - 2} cy={pupilOffsetY + 1} r="3" fill="white" />

      <rect
        x={-(EYE_RX + LID_OVERLAP)}
        y={lidY - EYE_RY * 2}
        width={(EYE_RX + LID_OVERLAP) * 2}
        height={EYE_RY * 2}
        fill="#d4a574"
        clipPath={`url(#${eyeId})`}
        style={{ transition: `y ${BLINK_DURATION_MS}ms ease-in-out` }}
      />

      <path d={browPath} fill="none" stroke="#2a2a2a" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

export const CartoonEyes = memo(({ className }: { className?: string }) => {
  const [visible, setVisible] = useState(false);
  const [blinkProgress, setBlinkProgress] = useState(0);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    function clearAllTimeouts(): void {
      for (const id of timeoutsRef.current) {
        clearTimeout(id);
      }
      timeoutsRef.current = [];
    }

    function scheduleAppearance(): void {
      const delay = randomBetween(MIN_SHOW_DELAY_MS, MAX_SHOW_DELAY_MS);
      const id = window.setTimeout(() => {
        setVisible(true);

        const hideId = window.setTimeout(() => {
          setVisible(false);

          const nextId = window.setTimeout(scheduleAppearance, FADE_DURATION_MS);
          timeoutsRef.current.push(nextId);
        }, VISIBLE_DURATION_MS);
        timeoutsRef.current.push(hideId);
      }, delay);
      timeoutsRef.current.push(id);
    }

    scheduleAppearance();

    return clearAllTimeouts;
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const blinkInterval = window.setInterval(() => {
      setBlinkProgress(1);
      const openId = window.setTimeout(() => setBlinkProgress(0), BLINK_DURATION_MS);
      timeoutsRef.current.push(openId);
    }, BLINK_INTERVAL_MS);

    const pupilInterval = window.setInterval(() => {
      setPupilOffset({
        x: randomBetween(-MAX_PUPIL_OFFSET, MAX_PUPIL_OFFSET),
        y: randomBetween(-MAX_PUPIL_OFFSET, MAX_PUPIL_OFFSET),
      });
    }, PUPIL_MOVE_INTERVAL_MS);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(pupilInterval);
      setBlinkProgress(0);
      setPupilOffset({ x: 0, y: 0 });
    };
  }, [visible]);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 flex items-start justify-center transition-opacity',
        visible ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
    >
      <svg
        viewBox="0 0 120 60"
        className="mt-[28%] ml-[10%] h-[30%] w-[30%] rotate-[10deg]"
        aria-hidden="true"
      >
        <Eye
          cx={35}
          cy={30}
          pupilOffsetX={pupilOffset.x - 2}
          pupilOffsetY={pupilOffset.y}
          blinkProgress={blinkProgress}
          browPath="M -18 -20 Q -6 -32, 6 -24"
          eyeId="lid-left"
        />
        <Eye
          cx={95}
          cy={30}
          scale={0.9}
          pupilOffsetX={pupilOffset.x + 2}
          pupilOffsetY={pupilOffset.y}
          blinkProgress={blinkProgress}
          browPath="M -6 -24 Q 6 -32, 18 -20"
          eyeId="lid-right"
        />
      </svg>
    </div>
  );
});
