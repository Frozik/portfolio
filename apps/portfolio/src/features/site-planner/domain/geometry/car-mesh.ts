import { CAR_HEIGHT_METERS, CAR_LENGTH_METERS, CAR_WIDTH_METERS } from '../constants';
import type { Meters } from '../units';
import type { ColoredMesh } from './lit-mesh';
import type { LocalPoint, MeshBuilder, Rgb } from './mesh-builder';
import { appendBox, appendQuad, createMeshBuilder, finishColoredMesh } from './mesh-builder';

/** `#8fa3bd` — the neutral grey-blue the plan draws a car in, in three dimensions. */
const BODY_COLOR: Rgb = [0.5608, 0.6392, 0.7412];
/** `#2b3442` — glass, read as the dark band a car's cabin is from any distance. */
const GLASS_COLOR: Rgb = [0.1686, 0.2039, 0.2588];
/** `#15181d` — tyres. */
const WHEEL_COLOR: Rgb = [0.0824, 0.0941, 0.1137];
/** The matte plastic cladding a crossover wears low around its body. */
const CLADDING_COLOR: Rgb = [0.13, 0.15, 0.18];
/** Roof rails and the light bar — brightwork against the body. */
const TRIM_COLOR: Rgb = [0.82, 0.85, 0.88];

const HALF = 0.5;

const WHEEL_RADIUS_METERS: Meters = 0.37;
const WHEEL_WIDTH_METERS: Meters = 0.25;
const WHEEL_SEGMENT_COUNT = 8;
/** How far the axles stand from the middle of the car, along its length. */
const AXLE_OFFSET_METERS: Meters = 1.45;

/** The cladding skirts the sills; the painted body starts over it. */
const CLADDING_BOTTOM_METERS: Meters = 0.22;
const CLADDING_TOP_METERS: Meters = 0.46;
/** The beltline — where the glasshouse takes over from the painted body. */
const BELTLINE_METERS: Meters = 1.06;
/** The wheels stand a little proud of the body, as they do on a real car. */
const BODY_WIDTH_METERS: Meters = CAR_WIDTH_METERS - 2 * WHEEL_WIDTH_METERS * HALF;

/**
 * The glasshouse: a raked windscreen well behind the long bonnet, a near
 * vertical tailgate — the one-and-a-half-box silhouette every current
 * crossover wears (the Jaecoo J8 class).
 */
const CABIN_FRONT_METERS: Meters = 0.75;
const CABIN_REAR_METERS: Meters = -2.25;
const ROOF_FRONT_METERS: Meters = 0.05;
const ROOF_REAR_METERS: Meters = -2.05;
const CABIN_WIDTH_INSET_METERS: Meters = 0.12;
/** The rails ride just над the roof panel, one along each edge. */
const ROOF_RAIL_HEIGHT_METERS: Meters = 0.05;
const ROOF_RAIL_WIDTH_METERS: Meters = 0.06;
/** The roof panel itself sits under the rails' top — the catalogue height. */
const ROOF_METERS: Meters = CAR_HEIGHT_METERS - ROOF_RAIL_HEIGHT_METERS;

/**
 * The one car every parked car on the plan is drawn from: a low-polygon
 * crossover in its own frame, in metres, with the length along `x`, the nose
 * at `+x` and the wheels standing on `y = 0`.
 *
 * Metres rather than the unit frame the tree templates use: a car is a typical
 * object of a fixed size ({@link CAR_LENGTH_METERS} and its siblings), so an
 * instance of it carries only where it stands and which way it faces — there are
 * no per-car scales for a unit template to be stretched by.
 */
export function buildCarTemplate(): ColoredMesh {
  const builder = createMeshBuilder();
  const halfLength = CAR_LENGTH_METERS * HALF;
  const halfWidth = BODY_WIDTH_METERS * HALF;

  // The painted body from the cladding up to the beltline.
  appendBox(builder, {
    minCorner: [-halfLength, CLADDING_TOP_METERS - 0.06, -halfWidth],
    maxCorner: [halfLength, BELTLINE_METERS, halfWidth],
    color: BODY_COLOR,
  });
  // The matte cladding skirting the sills — slightly narrower, full length.
  appendBox(builder, {
    minCorner: [-halfLength + 0.05, CLADDING_BOTTOM_METERS, -halfWidth + 0.02],
    maxCorner: [halfLength - 0.05, CLADDING_TOP_METERS, halfWidth - 0.02],
    color: CLADDING_COLOR,
  });
  // The dark grille filling the nose, and the light bar across its top.
  appendBox(builder, {
    minCorner: [halfLength - 0.03, CLADDING_TOP_METERS, -halfWidth * 0.7],
    maxCorner: [halfLength, BELTLINE_METERS - 0.35, halfWidth * 0.7],
    color: CLADDING_COLOR,
  });
  appendBox(builder, {
    minCorner: [halfLength - 0.03, BELTLINE_METERS - 0.3, -halfWidth * 0.8],
    maxCorner: [halfLength, BELTLINE_METERS - 0.22, halfWidth * 0.8],
    color: TRIM_COLOR,
  });
  // The tail lights, one full-width bar the way the segment draws them now.
  appendBox(builder, {
    minCorner: [-halfLength, BELTLINE_METERS - 0.28, -halfWidth * 0.8],
    maxCorner: [-halfLength + 0.03, BELTLINE_METERS - 0.2, halfWidth * 0.8],
    color: TRIM_COLOR,
  });
  appendCabin(builder);
  appendRoofRails(builder);
  appendWheels(builder);

  return finishColoredMesh(builder);
}

/**
 * The glasshouse as a frustum: raked hard at the windscreen, nearly upright at
 * the tailgate, the roof inset from the beltline on both sides.
 */
function appendCabin(builder: MeshBuilder): void {
  const waistHalfWidth = BODY_WIDTH_METERS * HALF - CABIN_WIDTH_INSET_METERS * HALF;
  const roofHalfWidth = waistHalfWidth - CABIN_WIDTH_INSET_METERS;

  const waist = (front: number, side: number): LocalPoint => [front, BELTLINE_METERS, side];
  const roof = (front: number, side: number): LocalPoint => [front, ROOF_METERS, side];

  // Windscreen, tailgate glass, the two window bands, then the roof panel.
  appendQuad(
    builder,
    waist(CABIN_FRONT_METERS, waistHalfWidth),
    waist(CABIN_FRONT_METERS, -waistHalfWidth),
    roof(ROOF_FRONT_METERS, -roofHalfWidth),
    roof(ROOF_FRONT_METERS, roofHalfWidth),
    GLASS_COLOR
  );
  appendQuad(
    builder,
    waist(CABIN_REAR_METERS, -waistHalfWidth),
    waist(CABIN_REAR_METERS, waistHalfWidth),
    roof(ROOF_REAR_METERS, roofHalfWidth),
    roof(ROOF_REAR_METERS, -roofHalfWidth),
    GLASS_COLOR
  );
  appendQuad(
    builder,
    waist(CABIN_REAR_METERS, waistHalfWidth),
    waist(CABIN_FRONT_METERS, waistHalfWidth),
    roof(ROOF_FRONT_METERS, roofHalfWidth),
    roof(ROOF_REAR_METERS, roofHalfWidth),
    GLASS_COLOR
  );
  appendQuad(
    builder,
    waist(CABIN_FRONT_METERS, -waistHalfWidth),
    waist(CABIN_REAR_METERS, -waistHalfWidth),
    roof(ROOF_REAR_METERS, -roofHalfWidth),
    roof(ROOF_FRONT_METERS, -roofHalfWidth),
    GLASS_COLOR
  );
  appendQuad(
    builder,
    roof(ROOF_REAR_METERS, -roofHalfWidth),
    roof(ROOF_REAR_METERS, roofHalfWidth),
    roof(ROOF_FRONT_METERS, roofHalfWidth),
    roof(ROOF_FRONT_METERS, -roofHalfWidth),
    BODY_COLOR
  );
}

/** Two bright bars along the roof edges — the crossover's rails. */
function appendRoofRails(builder: MeshBuilder): void {
  const roofHalfWidth =
    BODY_WIDTH_METERS * HALF - CABIN_WIDTH_INSET_METERS * HALF - CABIN_WIDTH_INSET_METERS;

  for (const side of [-1, 1]) {
    appendBox(builder, {
      minCorner: [
        ROOF_REAR_METERS + 0.15,
        ROOF_METERS,
        side * roofHalfWidth - (side > 0 ? ROOF_RAIL_WIDTH_METERS : 0),
      ],
      maxCorner: [
        ROOF_FRONT_METERS - 0.05,
        CAR_HEIGHT_METERS,
        side * roofHalfWidth + (side > 0 ? 0 : ROOF_RAIL_WIDTH_METERS),
      ],
      color: TRIM_COLOR,
    });
  }
}

/** Four low-polygon cylinders, their axles across the car. */
function appendWheels(builder: MeshBuilder): void {
  const sideOffset = CAR_WIDTH_METERS * HALF - WHEEL_WIDTH_METERS * HALF;

  for (const frontOffset of [AXLE_OFFSET_METERS, -AXLE_OFFSET_METERS]) {
    for (const side of [sideOffset, -sideOffset]) {
      appendWheel(builder, frontOffset, side);
    }
  }
}

function appendWheel(builder: MeshBuilder, frontOffset: Meters, side: Meters): void {
  const nearSide = side - WHEEL_WIDTH_METERS * HALF;
  const farSide = side + WHEEL_WIDTH_METERS * HALF;

  for (let segment = 0; segment < WHEEL_SEGMENT_COUNT; segment += 1) {
    const start = wheelRimPoint(segment, frontOffset);
    const end = wheelRimPoint(segment + 1, frontOffset);

    appendQuad(
      builder,
      [start.x, start.y, nearSide],
      [end.x, end.y, nearSide],
      [end.x, end.y, farSide],
      [start.x, start.y, farSide],
      WHEEL_COLOR
    );
  }
}

/** A point of the tyre's rim, `segment` steps around a full turn. */
function wheelRimPoint(
  segment: number,
  frontOffset: Meters
): { readonly x: number; readonly y: number } {
  const angle = (segment / WHEEL_SEGMENT_COUNT) * 2 * Math.PI;

  return {
    x: frontOffset + WHEEL_RADIUS_METERS * Math.cos(angle),
    y: WHEEL_RADIUS_METERS + WHEEL_RADIUS_METERS * Math.sin(angle),
  };
}

/** An axis-aligned box, every face wound so its normal points out of the volume. */
