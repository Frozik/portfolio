import { appendVerticalCylinder } from './furniture-mesh-primitives';
import type { PieceFrame } from './furniture-palette';
import {
  WOOD,
  WOOD_DARK,
  FABRIC,
  FABRIC_DARK,
  LINEN,
  APPLIANCE,
  APPLIANCE_DARK,
  METAL,
  HALF,
} from './furniture-palette';
import type { MeshBuilder } from './mesh-builder';
import { appendBox } from './mesh-builder';

/** What is sat on, slept in and eaten or worked at: beds, sofas, chairs and tables. */
/** Frame + мatress + pillows at the back, a blanket over the front two thirds. */
export function appendBed(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const frameTop = height * 0.5;
  const mattressTop = height * 0.9;
  const headboardDepth = 0.08;

  appendBox(builder, {
    minCorner: [-halfWidth, 0, -halfDepth],
    maxCorner: [halfWidth, frameTop, halfDepth],
    color: WOOD,
  });
  // The headboard stands at the back — the wall side — full width.
  appendBox(builder, {
    minCorner: [-halfWidth, 0, halfDepth - headboardDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color: WOOD_DARK,
  });
  appendBox(builder, {
    minCorner: [-halfWidth * 0.94, frameTop, -halfDepth * 0.96],
    maxCorner: [halfWidth * 0.94, mattressTop, halfDepth - headboardDepth],
    color: LINEN,
  });
  // Pillows, one per sleeper the width suggests.
  const pillowCount = halfWidth > 0.6 ? 2 : 1;
  const pillowWidth = (halfWidth * 2 * 0.7) / pillowCount;

  for (let index = 0; index < pillowCount; index += 1) {
    const left = -halfWidth * 0.7 + index * pillowWidth + pillowWidth * 0.08;

    appendBox(builder, {
      minCorner: [left, mattressTop, halfDepth - headboardDepth - 0.45],
      maxCorner: [left + pillowWidth * 0.84, height, halfDepth - headboardDepth - 0.06],
      color: LINEN,
    });
  }

  // The blanket, a fabric sheet over the foot half.
  appendBox(builder, {
    minCorner: [-halfWidth * 0.96, mattressTop, -halfDepth * 0.98],
    maxCorner: [halfWidth * 0.96, mattressTop + (height - mattressTop) * 0.5, halfDepth * 0.1],
    color: FABRIC,
  });
}

/** Base, back at the wall side, armrests; the armchair is the narrow twin. */
export function appendSofa(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const seatTop = height * 0.5;
  const armWidth = Math.min(0.16, halfWidth * 0.3);
  const backDepth = halfDepth * 0.45;

  appendBox(builder, {
    minCorner: [-halfWidth + armWidth, 0, -halfDepth],
    maxCorner: [halfWidth - armWidth, seatTop, halfDepth],
    color: FABRIC_DARK,
  });
  appendBox(builder, {
    minCorner: [-halfWidth + armWidth, seatTop, halfDepth - backDepth],
    maxCorner: [halfWidth - armWidth, height, halfDepth],
    color: FABRIC,
  });

  for (const side of [-1, 1]) {
    const inner = side * (halfWidth - armWidth);

    appendBox(builder, {
      minCorner: [Math.min(inner, side * halfWidth), 0, -halfDepth],
      maxCorner: [Math.max(inner, side * halfWidth), height * 0.78, halfDepth],
      color: FABRIC,
    });
  }

  // Seat cushions read as a split pad on top of the base.
  appendBox(builder, {
    minCorner: [-halfWidth + armWidth + 0.02, seatTop, -halfDepth + 0.02],
    maxCorner: [halfWidth - armWidth - 0.02, seatTop + 0.07, halfDepth - backDepth],
    color: FABRIC,
  });
}

/** A slab on four legs. */
export function appendTable(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame,
  { legInset }: { readonly legInset: number }
): void {
  const topThickness = 0.05;
  const legSize = 0.06;

  appendBox(builder, {
    minCorner: [-halfWidth, height - topThickness, -halfDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color: WOOD,
  });

  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      const x = sideX * (halfWidth - legInset - legSize * HALF);
      const z = sideZ * (halfDepth - legInset - legSize * HALF);

      appendBox(builder, {
        minCorner: [x - legSize * HALF, 0, z - legSize * HALF],
        maxCorner: [x + legSize * HALF, height - topThickness, z + legSize * HALF],
        color: WOOD_DARK,
      });
    }
  }
}

/** A worktop on two side panels, open at the knees. */
export function appendDesk(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const topThickness = 0.04;
  const panelThickness = 0.04;

  appendBox(builder, {
    minCorner: [-halfWidth, height - topThickness, -halfDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color: WOOD,
  });

  for (const side of [-1, 1]) {
    appendBox(builder, {
      minCorner: [side * halfWidth - (side > 0 ? panelThickness : 0), 0, -halfDepth],
      maxCorner: [
        side * halfWidth + (side > 0 ? 0 : panelThickness),
        height - topThickness,
        halfDepth,
      ],
      color: WOOD_DARK,
    });
  }
}

/** Seat on four legs with a backrest at the wall side. */
export function appendChair(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const seatHeight = height * 0.5;
  const seatThickness = 0.04;
  const legSize = 0.04;
  const backThickness = 0.05;

  appendBox(builder, {
    minCorner: [-halfWidth, seatHeight - seatThickness, -halfDepth],
    maxCorner: [halfWidth, seatHeight, halfDepth],
    color: WOOD,
  });
  appendBox(builder, {
    minCorner: [-halfWidth, seatHeight, halfDepth - backThickness],
    maxCorner: [halfWidth, height, halfDepth],
    color: WOOD_DARK,
  });

  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      const x = sideX * (halfWidth - legSize * HALF);
      const z = sideZ * (halfDepth - legSize * HALF);

      appendBox(builder, {
        minCorner: [x - legSize * HALF, 0, z - legSize * HALF],
        maxCorner: [x + legSize * HALF, seatHeight - seatThickness, z + legSize * HALF],
        color: WOOD_DARK,
      });
    }
  }
}

/** The wing chair: an armchair grown a tall back with side wings. */
export function appendWingChair(builder: MeshBuilder, frame: PieceFrame): void {
  const { halfWidth, halfDepth, height } = frame;

  appendSofa(builder, frame);
  // The wings: two narrow panels running the full back height at the sides.
  for (const side of [-1, 1]) {
    appendBox(builder, {
      minCorner: [side * halfWidth - (side > 0 ? 0.08 : 0), height * 0.4, halfDepth * 0.3],
      maxCorner: [side * halfWidth + (side > 0 ? 0 : 0.08), height, halfDepth],
      color: FABRIC,
    });
  }
}

/** Seat and backrest on a central column over a flat base disc. */
export function appendOfficeChair(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const seatHeight = height * 0.45;
  const baseRadius = Math.min(halfWidth, halfDepth);

  appendVerticalCylinder(builder, {
    centerX: 0,
    centerZ: 0,
    radius: baseRadius,
    bottom: 0,
    top: 0.04,
    color: APPLIANCE_DARK,
  });
  appendVerticalCylinder(builder, {
    centerX: 0,
    centerZ: 0,
    radius: 0.03,
    bottom: 0.04,
    top: seatHeight - 0.05,
    color: METAL,
  });
  appendBox(builder, {
    minCorner: [-halfWidth * 0.75, seatHeight - 0.05, -halfDepth * 0.75],
    maxCorner: [halfWidth * 0.75, seatHeight, halfDepth * 0.65],
    color: FABRIC_DARK,
  });
  appendBox(builder, {
    minCorner: [-halfWidth * 0.7, seatHeight, halfDepth * 0.5],
    maxCorner: [halfWidth * 0.7, height, halfDepth * 0.65],
    color: FABRIC,
  });
}

/** A round top on one central column and a base disc. */
export function appendRoundTable(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const topRadius = Math.min(halfWidth, halfDepth);

  appendVerticalCylinder(builder, {
    centerX: 0,
    centerZ: 0,
    radius: topRadius,
    bottom: height - 0.04,
    top: height,
    color: LINEN,
  });
  appendVerticalCylinder(builder, {
    centerX: 0,
    centerZ: 0,
    radius: 0.06,
    bottom: 0.03,
    top: height - 0.04,
    color: APPLIANCE,
  });
  appendVerticalCylinder(builder, {
    centerX: 0,
    centerZ: 0,
    radius: topRadius * 0.45,
    bottom: 0,
    top: 0.03,
    color: APPLIANCE,
  });
}
