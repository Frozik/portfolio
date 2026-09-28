import { memo } from 'react';
import type { ReactNode } from 'react';

type TChevronDirection = 'left' | 'right' | 'up' | 'down';
type THorizontalDirection = Extract<TChevronDirection, 'left' | 'right'>;

const ICON_SIZE = 16;

const CHEVRON_PATH: Readonly<Record<TChevronDirection, string>> = {
  left: 'M10 3 5 8l5 5',
  right: 'M6 3l5 5-5 5',
  up: 'M3 10l5-5 5 5',
  down: 'M3 6l5 5 5-5',
};

const DOUBLE_CHEVRON_PATH: Readonly<Record<THorizontalDirection, string>> = {
  left: 'M8 3 3 8l5 5M13 3 8 8l5 5',
  right: 'M3 3l5 5-5 5M8 3l5 5-5 5',
};

const CALENDAR_PATH = 'M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 1.5v3M10.5 1.5v3';

const Icon = ({ children }: { readonly children: ReactNode }) => (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const ChevronIcon = memo(({ direction }: { readonly direction: TChevronDirection }) => (
  <Icon>
    <path d={CHEVRON_PATH[direction]} />
  </Icon>
));

export const DoubleChevronIcon = memo(
  ({ direction }: { readonly direction: THorizontalDirection }) => (
    <Icon>
      <path d={DOUBLE_CHEVRON_PATH[direction]} />
    </Icon>
  )
);

export const CalendarIcon = memo(() => (
  <Icon>
    <path d={CALENDAR_PATH} />
  </Icon>
));
