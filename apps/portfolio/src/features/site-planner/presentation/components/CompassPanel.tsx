import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil, range } from 'lodash-es';
import { Navigation } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';

import { Button } from '../../../../shared/ui/Button';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { FULL_TURN_DEGREES } from '../../domain/units';
import { northNeedleAngleDegrees, northOffsetTowards } from '../../domain/view/north-offset';
import { rotationStepDegrees, snapLength } from '../../domain/view/snapping';
import { DEGREE_DECIMALS, NORTH_OFFSET_HISTORY_GROUP } from '../constants';
import { sitePlannerT } from '../translations';
import { buildCompassNeedle, dialPoint } from './compassNeedle';
import { PanelHint } from './PanelHint';
import { PropertyField } from './PropertyField';

/** The dial is authored in this square and scaled to whatever the class says. */
const VIEW_BOX_SIZE = 120;
const CENTER: Vector2 = { x: VIEW_BOX_SIZE / 2, y: VIEW_BOX_SIZE / 2 };
const RING_RADIUS = 44;
const NEEDLE_LENGTH = 34;
const TAIL_LENGTH = 24;
const NEEDLE_HALF_WIDTH = 6;
/** Just outside the ring, where both other compasses carry their caption too. */
const LABEL_RADIUS = 53;

/** A bearing is read to the sixteenth of a turn, which is also the Shift step. */
const TICK_STEP_DEGREES = 15;
const QUARTER_TURN_DEGREES = 90;
const TICK_LENGTH = 4;
const CARDINAL_TICK_LENGTH = 8;

const ICON_SIZE_PX = 14;
const NORTH_UP_DEGREES = 0;

/**
 * The ticks belong to the sheet rather than to the rose: they stand still while
 * the needle turns, so the plan's own up is always readable off the dial.
 */
const DIAL_TICKS = range(0, FULL_TURN_DEGREES, TICK_STEP_DEGREES).map(angleDegrees => {
  const isCardinal = angleDegrees % QUARTER_TURN_DEGREES === 0;

  return {
    angleDegrees,
    isCardinal,
    outer: dialPoint({ center: CENTER, radius: RING_RADIUS, angleDegrees }),
    inner: dialPoint({
      center: CENTER,
      radius: RING_RADIUS - (isCardinal ? CARDINAL_TICK_LENGTH : TICK_LENGTH),
      angleDegrees,
    }),
  };
});

/** The rose, from the needle round: north, then east, south and west. */
const CARDINAL_LABELS: readonly string[] = [
  sitePlannerT.compass.cardinals.north,
  sitePlannerT.compass.cardinals.east,
  sitePlannerT.compass.cardinals.south,
  sitePlannerT.compass.cardinals.west,
];

/**
 * The needle turned by hand. The plot is drawn the way it is convenient to draw
 * it and north is placed afterwards, which is a gesture rather than a number —
 * so it is snapped the way a shape's rotation handle is (a degree at a time,
 * Shift for 15°, Alt for none) and lands as a single step to undo.
 */
const CompassDial = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const isTurningRef = useRef(false);
  const needleAngleDegrees = northNeedleAngleDegrees(store.settings.location.northOffsetDegrees);
  const needle = buildCompassNeedle({
    center: CENTER,
    angleDegrees: needleAngleDegrees,
    northLength: NEEDLE_LENGTH,
    tailLength: TAIL_LENGTH,
    halfWidth: NEEDLE_HALF_WIDTH,
  });

  const turnTowardsPointer = useFunction((event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset: Vector2 = {
      x: event.clientX - (bounds.left + bounds.width / 2),
      y: event.clientY - (bounds.top + bounds.height / 2),
    };

    // The exact centre names no direction at all; the needle stays where it is.
    if (offset.x === 0 && offset.y === 0) {
      return;
    }

    store.setNorthOffsetDegrees(
      snapLength(
        northOffsetTowards(offset),
        rotationStepDegrees({ isAltPressed: event.altKey, isShiftPressed: event.shiftKey })
      )
    );
  });

  const handlePointerDown = useFunction((event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    isTurningRef.current = true;
    // Announced before the needle moves: everything until the pointer comes up
    // is one step to undo, however many moves it reports in between.
    store.pushHistory();
    turnTowardsPointer(event);
  });

  const handlePointerMove = useFunction((event: ReactPointerEvent<SVGSVGElement>) => {
    if (isTurningRef.current) {
      turnTowardsPointer(event);
    }
  });

  const handlePointerRelease = useFunction(() => {
    isTurningRef.current = false;
  });

  return (
    <svg
      role="img"
      aria-label={sitePlannerT.compass.dial}
      viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      className="size-32 max-w-full cursor-grab touch-none select-none self-center active:cursor-grabbing"
    >
      <circle
        cx={CENTER.x}
        cy={CENTER.y}
        r={RING_RADIUS}
        className="fill-black/25 stroke-white/15"
        strokeWidth={1}
      />
      {DIAL_TICKS.map(tick => (
        <line
          key={tick.angleDegrees}
          x1={tick.inner.x}
          y1={tick.inner.y}
          x2={tick.outer.x}
          y2={tick.outer.y}
          strokeWidth={1}
          className={tick.isCardinal ? 'stroke-white/45' : 'stroke-white/20'}
        />
      ))}
      <polygon points={needle.southPoints} className="fill-white/25" />
      <polygon points={needle.northPoints} className="fill-landing-accent" />
      {CARDINAL_LABELS.map((label, index) => {
        const point = dialPoint({
          center: CENTER,
          radius: LABEL_RADIUS,
          angleDegrees: needleAngleDegrees + index * QUARTER_TURN_DEGREES,
        });

        return (
          <text
            key={label}
            x={point.x}
            y={point.y}
            textAnchor="middle"
            dominantBaseline="central"
            className={cn(
              'font-mono text-[10px]',
              index === 0 ? 'fill-landing-accent' : 'fill-text-secondary'
            )}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
});

/**
 * Where north lies on the plot. A plan is drawn the way it is convenient to
 * draw it — the plot square to the sheet — and this is where the drawing is
 * told which way it actually faces, by eye on the dial or to the degree in the
 * field. Everything downstream follows: the compass in the plan's corner, the
 * gizmo over the 3D view, and the sun the shadows are cast by. Lives in the
 * plan settings drawer next to the location it modifies, reachable from both
 * views.
 */
export const CompassSettings = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { northOffsetDegrees } = store.settings.location;

  const handleAzimuthChange = useFunction((value: number | undefined) => {
    if (!isNil(value)) {
      // Typed one keystroke at a time, so the burst collapses into one step.
      store.pushHistory(NORTH_OFFSET_HISTORY_GROUP);
      store.setNorthOffsetDegrees(value);
    }
  });

  const handleResetToNorthUp = useFunction(() => {
    store.pushHistory();
    store.setNorthOffsetDegrees(NORTH_UP_DEGREES);
  });

  return (
    <div className="flex flex-col gap-2">
      <CompassDial store={store} />
      <PropertyField
        label={sitePlannerT.compass.azimuth}
        value={northOffsetDegrees}
        decimal={DEGREE_DECIMALS}
        onValueChange={handleAzimuthChange}
      />
      <Button
        variant="secondary"
        size="sm"
        disabled={northOffsetDegrees === NORTH_UP_DEGREES}
        onClick={handleResetToNorthUp}
      >
        <Navigation size={ICON_SIZE_PX} aria-hidden />
        {sitePlannerT.compass.resetToNorthUp}
      </Button>
      <PanelHint>{sitePlannerT.compass.hint}</PanelHint>
    </div>
  );
});
