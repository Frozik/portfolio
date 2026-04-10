import { memo } from 'react';
import { cn } from '../../../../shared/lib/cn';

export const SleepingZzz = memo(({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 flex items-start justify-center print:hidden',
        className
      )}
    >
      <svg
        viewBox="0 0 100 100"
        className="mt-[30%] ml-[40%] h-[30%] w-[30%] rotate-10"
        aria-hidden="true"
      >
        <g className="animate-zzz-1">
          <text
            x="10"
            y="80"
            fontSize="24"
            fontWeight="900"
            fontStyle="italic"
            fill="#1a3050"
            stroke="white"
            strokeWidth="4"
            strokeLinejoin="round"
            paintOrder="stroke"
            letterSpacing="2"
          >
            z
          </text>
        </g>
        <g className="animate-zzz-2">
          <text
            x="40"
            y="60"
            fontSize="34"
            fontWeight="900"
            fontStyle="italic"
            fill="#152840"
            stroke="white"
            strokeWidth="4"
            strokeLinejoin="round"
            paintOrder="stroke"
            letterSpacing="2"
          >
            Z
          </text>
        </g>
        <g className="animate-zzz-3">
          <text
            x="70"
            y="40"
            fontSize="44"
            fontWeight="900"
            fontStyle="italic"
            fill="#102030"
            stroke="white"
            strokeWidth="4"
            strokeLinejoin="round"
            paintOrder="stroke"
            letterSpacing="2"
          >
            Z
          </text>
        </g>
      </svg>
    </div>
  );
});
