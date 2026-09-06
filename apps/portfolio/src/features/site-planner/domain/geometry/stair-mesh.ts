import type { StairInstance } from '../model/stairs';
import type { SupportPost } from '../model/supports';
import type { Meters } from '../units';
import type { PolygonWithHoles, Ring } from './polygon-types';
import { rectangleLocalToPlan } from './polygonize-shape';
import { mirrorOf } from './stair-footprint';
import { stairLayout } from './stair-layouts';
import { SPIRAL_DEGREES_PER_RISER, SPIRAL_POLE_RADIUS_METERS } from './stair-run';

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * One solid step of a stair: its plan polygon in world metres, and how high
 * its walking surface stands over the storey floor. The 3D view extrudes each
 * from the floor up — the classic solid staircase, shadows included — and the
 * whole set re-derives whenever the storey height changes.
 */
export interface StairStep {
  readonly polygon: PolygonWithHoles;
  readonly topOffsetMeters: Meters;
}

export function stairStepPolygons(
  stair: StairInstance,
  storeyHeightMeters: Meters
): readonly StairStep[] {
  const layout = stairLayout(stair.kind, storeyHeightMeters, stair.widthMeters);
  const frame = { center: stair.position, rotationDegrees: stair.rotationDegrees };
  const mirror = mirrorOf(stair);
  const toWorld = (ring: Ring): PolygonWithHoles => ({
    outer: ring.map(point => rectangleLocalToPlan(frame, mirror(point))),
    holes: [],
  });

  if (stair.kind === 'spiral') {
    return spiralSteps(
      layout.run.riserCount,
      layout.run.riserMeters,
      stair.widthMeters / 2,
      SPIRAL_DEGREES_PER_RISER
    ).map(step => ({ ...step, polygon: toWorld(step.ring) }));
  }

  const steps: StairStep[] = [];

  for (const flight of layout.flights) {
    const across = { x: flight.direction.y, y: -flight.direction.x };
    const halfWidth = flight.widthMeters / 2;

    if (flight.lengthMeters === 0) {
      // A landing is one walkable slab at the height its riser gains.
      const half = flight.widthMeters / 2;
      const ring: Ring = [
        {
          x: flight.start.x - across.x * halfWidth - flight.direction.x * half,
          y: flight.start.y - across.y * halfWidth - flight.direction.y * half,
        },
        {
          x: flight.start.x + across.x * halfWidth - flight.direction.x * half,
          y: flight.start.y + across.y * halfWidth - flight.direction.y * half,
        },
        {
          x: flight.start.x + across.x * halfWidth + flight.direction.x * half,
          y: flight.start.y + across.y * halfWidth + flight.direction.y * half,
        },
        {
          x: flight.start.x - across.x * halfWidth + flight.direction.x * half,
          y: flight.start.y - across.y * halfWidth + flight.direction.y * half,
        },
      ];

      steps.push({
        polygon: toWorld(ring),
        topOffsetMeters: (flight.riserOffset + flight.riserCount) * layout.run.riserMeters,
      });
      continue;
    }

    const treadCount = Math.max(0, Math.round(flight.lengthMeters / layout.run.treadMeters));

    for (let index = 0; index < treadCount; index += 1) {
      const near = index * layout.run.treadMeters;
      const far = near + layout.run.treadMeters;
      const ring: Ring = [
        {
          x: flight.start.x - across.x * halfWidth + flight.direction.x * near,
          y: flight.start.y - across.y * halfWidth + flight.direction.y * near,
        },
        {
          x: flight.start.x + across.x * halfWidth + flight.direction.x * near,
          y: flight.start.y + across.y * halfWidth + flight.direction.y * near,
        },
        {
          x: flight.start.x + across.x * halfWidth + flight.direction.x * far,
          y: flight.start.y + across.y * halfWidth + flight.direction.y * far,
        },
        {
          x: flight.start.x - across.x * halfWidth + flight.direction.x * far,
          y: flight.start.y - across.y * halfWidth + flight.direction.y * far,
        },
      ];

      steps.push({
        polygon: toWorld(ring),
        topOffsetMeters: (flight.riserOffset + index + 1) * layout.run.riserMeters,
      });
    }
  }

  return steps;
}

function spiralSteps(
  riserCount: number,
  riserMeters: Meters,
  radius: number,
  degreesPerRiser: number
): readonly { readonly ring: Ring; readonly topOffsetMeters: Meters }[] {
  const steps: { ring: Ring; topOffsetMeters: Meters }[] = [];
  const startAngle = -Math.PI / 2;

  for (let index = 0; index < riserCount; index += 1) {
    const from = startAngle + index * degreesPerRiser * DEGREES_TO_RADIANS;
    const to = from + degreesPerRiser * DEGREES_TO_RADIANS;
    const ring: Ring = [
      {
        x: Math.cos(from) * SPIRAL_POLE_RADIUS_METERS,
        y: Math.sin(from) * SPIRAL_POLE_RADIUS_METERS,
      },
      { x: Math.cos(from) * radius, y: Math.sin(from) * radius },
      { x: Math.cos((from + to) / 2) * radius, y: Math.sin((from + to) / 2) * radius },
      { x: Math.cos(to) * radius, y: Math.sin(to) * radius },
      { x: Math.cos(to) * SPIRAL_POLE_RADIUS_METERS, y: Math.sin(to) * SPIRAL_POLE_RADIUS_METERS },
    ];

    steps.push({ ring, topOffsetMeters: (index + 1) * riserMeters });
  }

  return steps;
}

/** The post's plan cross-section: a square, or an octagon standing for round. */
export function supportFootprint(post: SupportPost): PolygonWithHoles {
  const half = post.sizeMeters / 2;

  if (post.profile === 'square') {
    return {
      outer: [
        { x: post.position.x - half, y: post.position.y - half },
        { x: post.position.x + half, y: post.position.y - half },
        { x: post.position.x + half, y: post.position.y + half },
        { x: post.position.x - half, y: post.position.y + half },
      ],
      holes: [],
    };
  }

  const SEGMENTS = 8;
  const outer = [];

  for (let index = 0; index < SEGMENTS; index += 1) {
    const angle = (index / SEGMENTS) * Math.PI * 2;

    outer.push({
      x: post.position.x + Math.cos(angle) * half,
      y: post.position.y + Math.sin(angle) * half,
    });
  }

  return { outer, holes: [] };
}
