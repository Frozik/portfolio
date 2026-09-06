import type { Vector2 } from '@frozik/utils/math/vector2';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { computeSceneNorthAngleDegrees } from '../../domain/view/scene-compass';
import { sitePlannerT } from '../translations';
import { buildCompassNeedle, dialPoint } from './compassNeedle';

/** The drawing is authored in this square and scaled to whatever the class says. */
const VIEW_BOX_SIZE = 44;
const CENTER: Vector2 = { x: VIEW_BOX_SIZE / 2, y: VIEW_BOX_SIZE / 2 };
const RING_RADIUS = 13;
const NEEDLE_LENGTH = 10;
const TAIL_LENGTH = 7;
const NEEDLE_HALF_WIDTH = 3.5;
/** Just outside the ring, where the 2D compass carries its caption too. */
const LABEL_RADIUS = 17;

/**
 * North over the 3D view, as the plan has in its own corner. The needle turns
 * with the camera and with the plot's north offset; the caption stays upright
 * rather than riding the needle round, so it reads at any heading.
 */
export const SceneCompass = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const angleDegrees = computeSceneNorthAngleDegrees({
    cameraYawDegrees: store.view.cameraYawDegrees,
    northOffsetDegrees: store.settings.location.northOffsetDegrees,
  });
  const needle = buildCompassNeedle({
    center: CENTER,
    angleDegrees,
    northLength: NEEDLE_LENGTH,
    tailLength: TAIL_LENGTH,
    halfWidth: NEEDLE_HALF_WIDTH,
  });
  const label = dialPoint({ center: CENTER, radius: LABEL_RADIUS, angleDegrees });

  return (
    <svg
      role="img"
      aria-label={sitePlannerT.scene.compass}
      viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
      className="pointer-events-none absolute top-3 right-3 size-11 text-text"
    >
      <circle
        cx={CENTER.x}
        cy={CENTER.y}
        r={RING_RADIUS}
        className="fill-black/60 stroke-white/20"
        strokeWidth={1}
      />
      <polygon points={needle.southPoints} className="fill-white/25" />
      <polygon points={needle.northPoints} className="fill-landing-accent" />
      <text
        x={label.x}
        y={label.y}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-current font-mono text-[9px]"
      >
        {sitePlannerT.plan.northLabel}
      </text>
    </svg>
  );
});
