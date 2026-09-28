import { cn } from '@frozik/components/components/cn';
import { memo } from 'react';

import {
  TOUCH_GLYPH_ACTIVE_OPACITY_CLASS,
  TOUCH_GLYPH_OPACITY_CLASS,
  TOUCH_GLYPH_SIZE_PX,
  TOUCH_GLYPH_VIEWBOX,
  TOUCH_RING_RADIUS_PX,
  TOUCH_ZONE_ACTIVE_FILL_CLASS,
  TOUCH_ZONE_IDLE_FILL_CLASS,
  TOUCH_ZONE_STROKE_CLASS,
  TOUCH_ZONE_TRANSITION_CLASS,
} from '../constants';

const SIGHT_RADIUS_PX = 26;
/** Out past the finger that presses the button, so the lit sight is seen around it. */
const TICK_START_PX = 40;
const TICK_END_PX = 58;
const SIGHT_TICKS_PATH =
  `M0 ${-TICK_START_PX}V${-TICK_END_PX}M0 ${TICK_START_PX}V${TICK_END_PX}` +
  `M${-TICK_START_PX} 0H${-TICK_END_PX}M${TICK_START_PX} 0H${TICK_END_PX}`;

export const FireGlyph = memo(
  ({
    isActive = false,
    className,
  }: {
    readonly isActive?: boolean;
    readonly className?: string;
  }) => (
    <svg
      viewBox={TOUCH_GLYPH_VIEWBOX}
      width={TOUCH_GLYPH_SIZE_PX}
      height={TOUCH_GLYPH_SIZE_PX}
      aria-hidden="true"
      className={className}
    >
      <circle
        r={TOUCH_RING_RADIUS_PX}
        className={cn(TOUCH_ZONE_IDLE_FILL_CLASS, TOUCH_ZONE_STROKE_CLASS)}
      />
      <circle
        r={SIGHT_RADIUS_PX}
        className={cn(
          TOUCH_ZONE_TRANSITION_CLASS,
          TOUCH_ZONE_STROKE_CLASS,
          isActive ? TOUCH_ZONE_ACTIVE_FILL_CLASS : TOUCH_ZONE_IDLE_FILL_CLASS
        )}
      />
      <path
        d={SIGHT_TICKS_PATH}
        strokeLinecap="round"
        className={cn(
          'fill-none stroke-white stroke-[3] transition-opacity duration-[80ms]',
          isActive ? TOUCH_GLYPH_ACTIVE_OPACITY_CLASS : TOUCH_GLYPH_OPACITY_CLASS
        )}
      />
    </svg>
  )
);
