import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TreeSpecies } from '../model/plot-objects';
import type { ColoredMesh } from './lit-mesh';
import type { LocalPoint, MeshBuilder, Rgb } from './mesh-builder';
import { appendQuad, appendTriangle, createMeshBuilder, finishColoredMesh } from './mesh-builder';

/** `#173420` — the near-black green of a spruce read against a lit sky. */
const SPRUCE_CROWN_COLOR: Rgb = [0.0902, 0.2039, 0.1255];
/** `#2c4a22` — a pine's warmer, more olive needles. */
const PINE_CROWN_COLOR: Rgb = [0.1725, 0.2902, 0.1333];
/** `#1f6b35` — the saturated green of a clipped thuja hedge plant. */
const THUJA_CROWN_COLOR: Rgb = [0.1216, 0.4196, 0.2078];
/** `#245031` — a lighter, warmer green for broadleaf foliage. */
const DECIDUOUS_CROWN_COLOR: Rgb = [0.1412, 0.3137, 0.1922];
/** `#3a2c1c` — bark, shared by every species. */
const TRUNK_COLOR: Rgb = [0.2275, 0.1725, 0.1098];

/** Trunk radius as a fraction of the crown radius. */
const TRUNK_RADIUS_FRACTION = 0.09;
const TRUNK_SEGMENT_COUNT = 6;

/** Where the spruce's skirt of branches starts, as a fraction of its height. */
const SPRUCE_CROWN_BASE_FRACTION = 0.16;
/** The trunk is carried a little into the cone, so no gap opens between them. */
const SPRUCE_TRUNK_TOP_FRACTION = 0.24;
const SPRUCE_SEGMENT_COUNT = 10;

/**
 * The pine: a bare trunk carrying its needles in a cap at the very top, which is
 * what tells a pine from a spruce at a glance on a plot. The trunk is thicker
 * than the other species' — with no branches to hide it, it is most of the tree.
 */
const PINE_TRUNK_TOP_FRACTION = 0.62;
const PINE_TRUNK_RADIUS_FRACTION = 0.13;
const PINE_CROWN_BASE_FRACTION = 0.55;
/** The cap is two tiers: the lower spreads, the upper closes the crown off. */
const PINE_LOWER_TIER_APEX_FRACTION = 0.85;
const PINE_UPPER_TIER_BASE_FRACTION = 0.74;
const PINE_UPPER_TIER_RADIUS = 0.7;
const PINE_SEGMENT_COUNT = 10;

/**
 * The thuja: a column of foliage standing on the ground rather than a crown on a
 * trunk, which is how a clipped one reads from every side. Its narrowness is the
 * crown radius the plan gives it — like every template it spans exactly one
 * radius across, so the circle on the plan and the plant in 3D are the same
 * width; what makes it a column is the crown filling the whole height.
 */
const THUJA_CROWN_BOTTOM_FRACTION = 0.04;
const THUJA_MERIDIAN_COUNT = 8;
/** Even, so a band lands on the equator and the column reaches its full radius. */
const THUJA_PARALLEL_COUNT = 6;

/** The broadleaf crown: an ellipsoid spanning the top three quarters of the tree. */
const DECIDUOUS_CROWN_BOTTOM_FRACTION = 0.3;
const DECIDUOUS_TRUNK_TOP_FRACTION = 0.42;
const DECIDUOUS_MERIDIAN_COUNT = 8;
const DECIDUOUS_PARALLEL_COUNT = 4;

const FULL_TURN_RADIANS = 2 * Math.PI;
const HALF = 0.5;

/**
 * The species as templates: low-polygon meshes in their own frame, with the base
 * of the trunk at the origin, the crown reaching out to one crown radius in `x`
 * and `z` and the top of the tree at `y = 1`.
 *
 * Templates rather than finished geometry because every tree of a species is the
 * same shape at a different size: the 3D view uploads each of these once and
 * draws the whole orchard from it, one instance per tree carrying its place on
 * the terrain and its two scales. A tree that is wide for its height therefore
 * comes out as a squashed version of its species, which is exactly how the plan
 * describes it — a crown radius and a height, not a species catalogue.
 *
 * Every template reaches exactly one crown radius across, whatever its
 * silhouette: the plan draws that radius as the tree's circle, so a species
 * whose template fell short of it would spread less in 3D than on the plan.
 */
export function buildTreeTemplate(species: TreeSpecies): ColoredMesh {
  switch (species) {
    case 'spruce':
      return buildSpruceTemplate();
    case 'pine':
      return buildPineTemplate();
    case 'thuja':
      return buildThujaTemplate();
    case 'deciduous':
      return buildDeciduousTemplate();
    default:
      return assertNever(species);
  }
}

/** A cone of branches over a short bare trunk. */
function buildSpruceTemplate(): ColoredMesh {
  const builder = createMeshBuilder();

  appendCylinder(builder, {
    radius: TRUNK_RADIUS_FRACTION,
    bottomY: 0,
    topY: SPRUCE_TRUNK_TOP_FRACTION,
    segmentCount: TRUNK_SEGMENT_COUNT,
    color: TRUNK_COLOR,
  });
  appendCone(builder, {
    baseRadius: 1,
    baseY: SPRUCE_CROWN_BASE_FRACTION,
    apexY: 1,
    segmentCount: SPRUCE_SEGMENT_COUNT,
    color: SPRUCE_CROWN_COLOR,
  });

  return finishColoredMesh(builder);
}

/** A long bare trunk under a two-tier cap of needles. */
function buildPineTemplate(): ColoredMesh {
  const builder = createMeshBuilder();

  appendCylinder(builder, {
    radius: PINE_TRUNK_RADIUS_FRACTION,
    bottomY: 0,
    topY: PINE_TRUNK_TOP_FRACTION,
    segmentCount: TRUNK_SEGMENT_COUNT,
    color: TRUNK_COLOR,
  });
  appendCone(builder, {
    baseRadius: 1,
    baseY: PINE_CROWN_BASE_FRACTION,
    apexY: PINE_LOWER_TIER_APEX_FRACTION,
    segmentCount: PINE_SEGMENT_COUNT,
    color: PINE_CROWN_COLOR,
  });
  appendCone(builder, {
    baseRadius: PINE_UPPER_TIER_RADIUS,
    baseY: PINE_UPPER_TIER_BASE_FRACTION,
    apexY: 1,
    segmentCount: PINE_SEGMENT_COUNT,
    color: PINE_CROWN_COLOR,
  });

  return finishColoredMesh(builder);
}

/** A column of foliage: an ellipsoid standing on the ground, no trunk to show. */
function buildThujaTemplate(): ColoredMesh {
  const builder = createMeshBuilder();

  appendEllipsoid(builder, {
    radius: 1,
    bottomY: THUJA_CROWN_BOTTOM_FRACTION,
    topY: 1,
    meridianCount: THUJA_MERIDIAN_COUNT,
    parallelCount: THUJA_PARALLEL_COUNT,
    color: THUJA_CROWN_COLOR,
  });
  appendCylinder(builder, {
    radius: TRUNK_RADIUS_FRACTION,
    bottomY: 0,
    topY: THUJA_CROWN_BOTTOM_FRACTION * 2,
    segmentCount: TRUNK_SEGMENT_COUNT,
    color: TRUNK_COLOR,
  });

  return finishColoredMesh(builder);
}

/** A rounded crown on a taller trunk. */
function buildDeciduousTemplate(): ColoredMesh {
  const builder = createMeshBuilder();

  appendCylinder(builder, {
    radius: TRUNK_RADIUS_FRACTION,
    bottomY: 0,
    topY: DECIDUOUS_TRUNK_TOP_FRACTION,
    segmentCount: TRUNK_SEGMENT_COUNT,
    color: TRUNK_COLOR,
  });
  appendEllipsoid(builder, {
    radius: 1,
    bottomY: DECIDUOUS_CROWN_BOTTOM_FRACTION,
    topY: 1,
    meridianCount: DECIDUOUS_MERIDIAN_COUNT,
    parallelCount: DECIDUOUS_PARALLEL_COUNT,
    color: DECIDUOUS_CROWN_COLOR,
  });

  return finishColoredMesh(builder);
}

/** The trunk: an open tube, its foot hidden by the ground it stands on. */
function appendCylinder(
  builder: MeshBuilder,
  {
    radius,
    bottomY,
    topY,
    segmentCount,
    color,
  }: {
    readonly radius: number;
    readonly bottomY: number;
    readonly topY: number;
    readonly segmentCount: number;
    readonly color: Rgb;
  }
): void {
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const start = ringPoint(segment, segmentCount, radius);
    const end = ringPoint(segment + 1, segmentCount, radius);

    appendQuad(
      builder,
      [start.x, bottomY, start.z],
      [start.x, topY, start.z],
      [end.x, topY, end.z],
      [end.x, bottomY, end.z],
      color
    );
  }
}

/** A conifer tier: a skirt of triangles plus the disc closing it underneath. */
function appendCone(
  builder: MeshBuilder,
  {
    baseRadius,
    baseY,
    apexY,
    segmentCount,
    color,
  }: {
    readonly baseRadius: number;
    readonly baseY: number;
    readonly apexY: number;
    readonly segmentCount: number;
    readonly color: Rgb;
  }
): void {
  const apex: LocalPoint = [0, apexY, 0];
  const center: LocalPoint = [0, baseY, 0];

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const start = ringPoint(segment, segmentCount, baseRadius);
    const end = ringPoint(segment + 1, segmentCount, baseRadius);
    const startPoint: LocalPoint = [start.x, baseY, start.z];
    const endPoint: LocalPoint = [end.x, baseY, end.z];

    appendTriangle(builder, endPoint, startPoint, apex, color);
    appendTriangle(builder, startPoint, endPoint, center, color);
  }
}

/**
 * A crown of latitude bands, scaled in `y` to the span it is given. Squashing a
 * sphere rather than keeping it round is what lets one template serve a tree of
 * any proportion — and what makes the thuja's column the same code as the
 * broadleaf's dome.
 */
function appendEllipsoid(
  builder: MeshBuilder,
  {
    radius,
    bottomY,
    topY,
    meridianCount,
    parallelCount,
    color,
  }: {
    readonly radius: number;
    readonly bottomY: number;
    readonly topY: number;
    readonly meridianCount: number;
    readonly parallelCount: number;
    readonly color: Rgb;
  }
): void {
  const centerY = (bottomY + topY) * HALF;
  const verticalRadius = (topY - bottomY) * HALF;

  const pointAt = (parallel: number, meridian: number): LocalPoint => {
    const polarAngle = (parallel / parallelCount) * Math.PI;
    const ring = ringPoint(meridian, meridianCount, radius * Math.sin(polarAngle));

    return [ring.x, centerY + verticalRadius * Math.cos(polarAngle), ring.z];
  };

  for (let parallel = 0; parallel < parallelCount; parallel += 1) {
    for (let meridian = 0; meridian < meridianCount; meridian += 1) {
      const topLeft = pointAt(parallel, meridian);
      const topRight = pointAt(parallel, meridian + 1);
      const bottomRight = pointAt(parallel + 1, meridian + 1);
      const bottomLeft = pointAt(parallel + 1, meridian);

      // The bands touching the poles collapse into triangles; a quad there
      // would carry a degenerate half with no normal to take.
      if (parallel === 0) {
        appendTriangle(builder, topLeft, bottomRight, bottomLeft, color);

        continue;
      }

      if (parallel === parallelCount - 1) {
        appendTriangle(builder, topLeft, topRight, bottomRight, color);

        continue;
      }

      appendQuad(builder, topLeft, topRight, bottomRight, bottomLeft, color);
    }
  }
}

/** A point of a horizontal ring, `segment` steps around a full turn. */
function ringPoint(
  segment: number,
  segmentCount: number,
  radius: number
): { readonly x: number; readonly z: number } {
  const angle = (segment / segmentCount) * FULL_TURN_RADIANS;

  return { x: radius * Math.cos(angle), z: radius * Math.sin(angle) };
}
