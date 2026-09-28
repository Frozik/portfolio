import { cn } from '@frozik/components/components/cn';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { memo } from 'react';

import type { Direction } from '../../domain/types';
import {
  JOYSTICK_KNOB_RADIUS_PX,
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
import { JOYSTICK_DEAD_ZONE_RADIUS_PX } from '../floating-joystick';

const CHEVRON_TIP_DISTANCE_PX = 54;
const CHEVRON_HALF_WIDTH_PX = 10;
const CHEVRON_DEPTH_PX = 9;
const CHEVRON_POINTS =
  `${-CHEVRON_HALF_WIDTH_PX},${-CHEVRON_TIP_DISTANCE_PX + CHEVRON_DEPTH_PX} ` +
  `0,${-CHEVRON_TIP_DISTANCE_PX} ` +
  `${CHEVRON_HALF_WIDTH_PX},${-CHEVRON_TIP_DISTANCE_PX + CHEVRON_DEPTH_PX}`;

const DEGREES_TO_RADIANS = Math.PI / 180;
const UP_DEGREES = -90;
const HALF_QUADRANT_DEGREES = 45;
const ARC_GAP_DEGREES = 8;

function pointOnRing(degrees: number): string {
  const radians = degrees * DEGREES_TO_RADIANS;

  return `${Math.cos(radians) * TOUCH_RING_RADIUS_PX} ${Math.sin(radians) * TOUCH_RING_RADIUS_PX}`;
}

/** The part of the ring a direction owns: a thumb pushed that way hides its chevron, not this. */
const SECTOR_ARC_PATH =
  `M${pointOnRing(UP_DEGREES - HALF_QUADRANT_DEGREES + ARC_GAP_DEGREES)}` +
  `A${TOUCH_RING_RADIUS_PX} ${TOUCH_RING_RADIUS_PX} 0 0 1 ` +
  pointOnRing(UP_DEGREES + HALF_QUADRANT_DEGREES - ARC_GAP_DEGREES);

const QUARTER_TURN_DEGREES = 90;
/** Every mark is drawn pointing up, then turned a quarter at a time in this clockwise order. */
const MARK_DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];

const MARK_BASE_CLASS = 'fill-none stroke-white stroke-[3] transition-opacity duration-[80ms]';

const CENTERED_OFFSET: Vector2 = { x: 0, y: 0 };

export const JoystickGlyph = memo(
  ({
    thumbOffset = CENTERED_OFFSET,
    direction,
    className,
  }: {
    /** The thumb relative to the stick's centre, in CSS pixels. */
    readonly thumbOffset?: Vector2;
    readonly direction?: Direction;
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
        r={JOYSTICK_DEAD_ZONE_RADIUS_PX}
        className={cn('fill-none', TOUCH_ZONE_STROKE_CLASS)}
      />
      {MARK_DIRECTIONS.map((markDirection, index) => (
        <g
          key={markDirection}
          transform={`rotate(${index * QUARTER_TURN_DEGREES})`}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d={SECTOR_ARC_PATH}
            className={cn(
              MARK_BASE_CLASS,
              markDirection === direction ? TOUCH_GLYPH_ACTIVE_OPACITY_CLASS : 'opacity-0'
            )}
          />
          <polyline
            points={CHEVRON_POINTS}
            className={cn(
              MARK_BASE_CLASS,
              markDirection === direction
                ? TOUCH_GLYPH_ACTIVE_OPACITY_CLASS
                : TOUCH_GLYPH_OPACITY_CLASS
            )}
          />
        </g>
      ))}
      <circle
        cx={thumbOffset.x}
        cy={thumbOffset.y}
        r={JOYSTICK_KNOB_RADIUS_PX}
        className={cn(
          TOUCH_ZONE_TRANSITION_CLASS,
          TOUCH_ZONE_STROKE_CLASS,
          direction === undefined ? TOUCH_ZONE_IDLE_FILL_CLASS : TOUCH_ZONE_ACTIVE_FILL_CLASS
        )}
      />
    </svg>
  )
);
