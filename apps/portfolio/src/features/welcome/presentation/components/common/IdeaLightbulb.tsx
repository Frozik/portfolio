import { memo, useEffect, useRef, useState } from 'react';

import { cn } from '../../../../../shared/lib/cn';

const MIN_SHOW_DELAY_MS = 2_000;
const MAX_SHOW_DELAY_MS = 5_000;
const VISIBLE_DURATION_MS = 6_000;
const FADE_DURATION_MS = 400;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const IdeaLightbulbComponent = ({ className }: { className?: string }) => {
  const [visible, setVisible] = useState(false);
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

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 flex justify-end transition-opacity print:hidden',
        visible ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
    >
      <svg
        viewBox="0 0 80 120"
        className="-mt-[10%] mr-[2%] h-[45%] w-[45%] origin-[50%_0%] animate-bulb-swing"
        aria-hidden="true"
      >
        <line x1="40" y1="0" x2="40" y2="40" stroke="#888" strokeWidth="1.5" />
        <circle cx="40" cy="58" r="28" className="animate-bulb-glow" fill="#ffd54f" opacity="0.2" />
        <ellipse
          cx="40"
          cy="55"
          rx="16"
          ry="18"
          fill="#ffe082"
          stroke="#fbc02d"
          strokeWidth="1.5"
        />
        <ellipse cx="35" cy="48" rx="5" ry="7" fill="white" opacity="0.5" />
        <rect
          x="33"
          y="72"
          width="14"
          height="4"
          rx="1"
          fill="#bdbdbd"
          stroke="#9e9e9e"
          strokeWidth="0.5"
        />
        <rect
          x="34"
          y="76"
          width="12"
          height="3"
          rx="1"
          fill="#a0a0a0"
          stroke="#9e9e9e"
          strokeWidth="0.5"
        />
        <rect
          x="35"
          y="79"
          width="10"
          height="3"
          rx="1"
          fill="#909090"
          stroke="#9e9e9e"
          strokeWidth="0.5"
        />
        <path d="M 37 82 Q 40 86 43 82" fill="#808080" stroke="#9e9e9e" strokeWidth="0.5" />
        <g className="animate-bulb-rays" opacity="0.6">
          <line
            x1="12"
            y1="38"
            x2="20"
            y2="44"
            stroke="#ffd54f"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="68"
            y1="38"
            x2="60"
            y2="44"
            stroke="#ffd54f"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="58"
            x2="20"
            y2="58"
            stroke="#ffd54f"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="70"
            y1="58"
            x2="60"
            y2="58"
            stroke="#ffd54f"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="14"
            y1="76"
            x2="22"
            y2="70"
            stroke="#ffd54f"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="66"
            y1="76"
            x2="58"
            y2="70"
            stroke="#ffd54f"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
};

export const IdeaLightbulb = memo(IdeaLightbulbComponent);
