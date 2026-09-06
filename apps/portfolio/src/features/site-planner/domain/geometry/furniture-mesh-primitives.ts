import { CYLINDER_SEGMENT_COUNT, FULL_TURN_RADIANS } from './furniture-palette';
import type { LocalPoint, MeshBuilder, Rgb } from './mesh-builder';
import { appendBox, appendQuad, appendTriangle } from './mesh-builder';

/** A closed vertical cylinder between two heights. */
export function appendVerticalCylinder(
  builder: MeshBuilder,
  {
    centerX,
    centerZ,
    radius,
    bottom,
    top,
    color,
  }: {
    readonly centerX: number;
    readonly centerZ: number;
    readonly radius: number;
    readonly bottom: number;
    readonly top: number;
    readonly color: Rgb;
  }
): void {
  const ring = (angleIndex: number): readonly [number, number] => {
    const angle = (angleIndex / CYLINDER_SEGMENT_COUNT) * FULL_TURN_RADIANS;

    return [centerX + Math.cos(angle) * radius, centerZ + Math.sin(angle) * radius];
  };

  for (let index = 0; index < CYLINDER_SEGMENT_COUNT; index += 1) {
    const [x0, z0] = ring(index);
    const [x1, z1] = ring(index + 1);

    appendQuad(builder, [x1, bottom, z1], [x0, bottom, z0], [x0, top, z0], [x1, top, z1], color);
    appendTriangle(builder, [centerX, top, centerZ], [x1, top, z1], [x0, top, z0], color);
    appendTriangle(builder, [centerX, bottom, centerZ], [x0, bottom, z0], [x1, bottom, z1], color);
  }
}

/** A rectangle frustum: a box whose top spreads (or narrows) over its bottom. */
export function appendFrustum(
  builder: MeshBuilder,
  {
    bottomHalfX,
    bottomHalfZ,
    topHalfX,
    topHalfZ,
    bottom,
    top,
    color,
  }: {
    readonly bottomHalfX: number;
    readonly bottomHalfZ: number;
    readonly topHalfX: number;
    readonly topHalfZ: number;
    readonly bottom: number;
    readonly top: number;
    readonly color: Rgb;
  }
): void {
  const corner = (halfX: number, halfZ: number, y: number, sx: number, sz: number): LocalPoint => [
    sx * halfX,
    y,
    sz * halfZ,
  ];

  // The four raked sides, each wound outward, then the flat top.
  appendQuad(
    builder,
    corner(bottomHalfX, bottomHalfZ, bottom, -1, -1),
    corner(bottomHalfX, bottomHalfZ, bottom, 1, -1),
    corner(topHalfX, topHalfZ, top, 1, -1),
    corner(topHalfX, topHalfZ, top, -1, -1),
    color
  );
  appendQuad(
    builder,
    corner(bottomHalfX, bottomHalfZ, bottom, 1, 1),
    corner(bottomHalfX, bottomHalfZ, bottom, -1, 1),
    corner(topHalfX, topHalfZ, top, -1, 1),
    corner(topHalfX, topHalfZ, top, 1, 1),
    color
  );
  appendQuad(
    builder,
    corner(bottomHalfX, bottomHalfZ, bottom, 1, -1),
    corner(bottomHalfX, bottomHalfZ, bottom, 1, 1),
    corner(topHalfX, topHalfZ, top, 1, 1),
    corner(topHalfX, topHalfZ, top, 1, -1),
    color
  );
  appendQuad(
    builder,
    corner(bottomHalfX, bottomHalfZ, bottom, -1, 1),
    corner(bottomHalfX, bottomHalfZ, bottom, -1, -1),
    corner(topHalfX, topHalfZ, top, -1, -1),
    corner(topHalfX, topHalfZ, top, -1, 1),
    color
  );
  appendQuad(
    builder,
    corner(topHalfX, topHalfZ, top, -1, -1),
    corner(topHalfX, topHalfZ, top, 1, -1),
    corner(topHalfX, topHalfZ, top, 1, 1),
    corner(topHalfX, topHalfZ, top, -1, 1),
    color
  );
}

/** A flat top made of a rim frame around a lower inner face. */
export function appendRimmedTop(
  builder: MeshBuilder,
  {
    halfWidth,
    halfDepth,
    rimThickness,
    top,
    innerY,
    rimColor,
  }: {
    readonly halfWidth: number;
    readonly halfDepth: number;
    readonly rimThickness: number;
    readonly top: number;
    readonly innerY: number;
    readonly rimColor: Rgb;
  }
): void {
  const innerHalfWidth = halfWidth - rimThickness;
  const innerHalfDepth = halfDepth - rimThickness;

  // The four flat rim strips.
  appendBox(builder, {
    minCorner: [-halfWidth, top - 0.02, -halfDepth],
    maxCorner: [halfWidth, top, -innerHalfDepth],
    color: rimColor,
  });
  appendBox(builder, {
    minCorner: [-halfWidth, top - 0.02, innerHalfDepth],
    maxCorner: [halfWidth, top, halfDepth],
    color: rimColor,
  });
  appendBox(builder, {
    minCorner: [-halfWidth, top - 0.02, -innerHalfDepth],
    maxCorner: [-innerHalfWidth, top, innerHalfDepth],
    color: rimColor,
  });
  appendBox(builder, {
    minCorner: [innerHalfWidth, top - 0.02, -innerHalfDepth],
    maxCorner: [halfWidth, top, innerHalfDepth],
    color: rimColor,
  });
  // The inner walls dropping from the rim to the water line.
  appendBox(builder, {
    minCorner: [-innerHalfWidth, innerY, -innerHalfDepth],
    maxCorner: [innerHalfWidth, top - 0.02, innerHalfDepth],
    color: rimColor,
  });
}

/** A disc lying on a vertical front face — the washing machine's porthole. */
export function appendVerticalDiscOnFront(
  builder: MeshBuilder,
  {
    centerX,
    centerY,
    radius,
    frontZ,
    thickness,
    color,
  }: {
    readonly centerX: number;
    readonly centerY: number;
    readonly radius: number;
    readonly frontZ: number;
    readonly thickness: number;
    readonly color: Rgb;
  }
): void {
  const ring = (angleIndex: number): readonly [number, number] => {
    const angle = (angleIndex / CYLINDER_SEGMENT_COUNT) * FULL_TURN_RADIANS;

    return [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius];
  };

  for (let index = 0; index < CYLINDER_SEGMENT_COUNT; index += 1) {
    const [x0, y0] = ring(index);
    const [x1, y1] = ring(index + 1);
    const face = frontZ - thickness;

    // The visible face, wound towards −z, plus the side band back to the body.
    appendTriangle(builder, [centerX, centerY, face], [x1, y1, face], [x0, y0, face], color);
    appendQuad(builder, [x0, y0, frontZ], [x0, y0, face], [x1, y1, face], [x1, y1, frontZ], color);
  }
}
