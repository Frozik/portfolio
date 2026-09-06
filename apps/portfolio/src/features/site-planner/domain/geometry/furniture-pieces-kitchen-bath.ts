import {
  appendVerticalCylinder,
  appendFrustum,
  appendRimmedTop,
  appendVerticalDiscOnFront,
} from './furniture-mesh-primitives';
import type { PieceFrame } from './furniture-palette';
import {
  WOOD,
  WOOD_DARK,
  PORCELAIN,
  PORCELAIN_SHADE,
  APPLIANCE,
  APPLIANCE_DARK,
  METAL,
  GLASS,
  WATER,
  HALF,
} from './furniture-palette';
import type { MeshBuilder } from './mesh-builder';
import { appendBox } from './mesh-builder';

/** The pieces of the kitchen, bathroom and utility room: appliances, fixtures and the heating. */
/** Cabinets under a darker worktop, a sink bowl let into one end. */
export function appendKitchenRun(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const worktopThickness = 0.04;
  const plinth = 0.08;
  const faceDepth = 0.02;

  appendBox(builder, {
    minCorner: [-halfWidth + 0.02, 0, -halfDepth + 0.05],
    maxCorner: [halfWidth - 0.02, plinth, halfDepth],
    color: APPLIANCE_DARK,
  });
  appendBox(builder, {
    minCorner: [-halfWidth, plinth, -halfDepth + faceDepth],
    maxCorner: [halfWidth, height - worktopThickness, halfDepth],
    color: WOOD,
  });
  appendBox(builder, {
    minCorner: [-halfWidth, height - worktopThickness, -halfDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color: APPLIANCE_DARK,
  });

  const doorCount = Math.max(2, Math.round((halfWidth * 2) / 0.6));
  const doorWidth = (halfWidth * 2 - 0.04) / doorCount;

  for (let index = 0; index < doorCount; index += 1) {
    const left = -halfWidth + 0.02 + index * doorWidth;

    appendBox(builder, {
      minCorner: [left + 0.01, plinth + 0.01, -halfDepth],
      maxCorner: [
        left + doorWidth - 0.01,
        height - worktopThickness - 0.01,
        -halfDepth + faceDepth,
      ],
      color: WOOD_DARK,
    });
  }

  // The sink: a rim standing just proud of the worktop — never coplanar with
  // it, or the two faces fight in the depth buffer and shimmer.
  appendBox(builder, {
    minCorner: [halfWidth - 0.55, height - 0.006, -halfDepth * 0.55],
    maxCorner: [halfWidth - 0.15, height + 0.004, halfDepth * 0.55],
    color: METAL,
  });
}

/** The tall white box with a freezer seam and door handles. */
export function appendFridge(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const faceDepth = 0.02;
  const seamY = height * 0.65;

  appendBox(builder, {
    minCorner: [-halfWidth, 0, -halfDepth + faceDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color: APPLIANCE,
  });
  appendBox(builder, {
    minCorner: [-halfWidth + 0.01, 0.02, -halfDepth],
    maxCorner: [halfWidth - 0.01, seamY - 0.01, -halfDepth + faceDepth],
    color: APPLIANCE,
  });
  appendBox(builder, {
    minCorner: [-halfWidth + 0.01, seamY + 0.01, -halfDepth],
    maxCorner: [halfWidth - 0.01, height - 0.02, -halfDepth + faceDepth],
    color: APPLIANCE,
  });

  for (const bottom of [seamY + 0.06, seamY - 0.36]) {
    appendBox(builder, {
      minCorner: [-halfWidth + 0.04, bottom, -halfDepth - 0.01],
      maxCorner: [-halfWidth + 0.07, bottom + 0.3, -halfDepth],
      color: METAL,
    });
  }
}

/** An oven under a dark cooktop with four burners. */
export function appendStove(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const cooktopThickness = 0.03;

  appendBox(builder, {
    minCorner: [-halfWidth, 0, -halfDepth],
    maxCorner: [halfWidth, height - cooktopThickness, halfDepth],
    color: APPLIANCE,
  });
  appendBox(builder, {
    minCorner: [-halfWidth, height - cooktopThickness, -halfDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color: APPLIANCE_DARK,
  });
  // The oven window.
  appendBox(builder, {
    minCorner: [-halfWidth * 0.7, height * 0.25, -halfDepth - 0.01],
    maxCorner: [halfWidth * 0.7, height * 0.6, -halfDepth],
    color: APPLIANCE_DARK,
  });

  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      appendVerticalCylinder(builder, {
        centerX: sideX * halfWidth * 0.45,
        centerZ: sideZ * halfDepth * 0.4,
        radius: Math.min(halfWidth, halfDepth) * 0.3,
        bottom: height - 0.002,
        top: height + 0.004,
        color: METAL,
      });
    }
  }
}

/** How far the tap stands over the basin rim; the catalogue height is its top. */
const SINK_TAP_RISE_METERS = 0.15;

/** A pedestal carrying a basin, the tap rising at the wall side. */
export function appendSink(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const basinTop = height - SINK_TAP_RISE_METERS;
  const basinBottom = basinTop - 0.18;

  appendBox(builder, {
    minCorner: [-halfWidth * 0.35, 0, -halfDepth * 0.4],
    maxCorner: [halfWidth * 0.35, basinBottom, halfDepth * 0.5],
    color: PORCELAIN_SHADE,
  });
  appendFrustum(builder, {
    bottomHalfX: halfWidth * 0.55,
    bottomHalfZ: halfDepth * 0.55,
    topHalfX: halfWidth,
    topHalfZ: halfDepth,
    bottom: basinBottom,
    top: basinTop,
    color: PORCELAIN,
  });
  // The tap: a short column and its spout reaching over the basin.
  appendBox(builder, {
    minCorner: [-0.02, basinTop, halfDepth - 0.08],
    maxCorner: [0.02, height, halfDepth - 0.04],
    color: METAL,
  });
  appendBox(builder, {
    minCorner: [-0.02, height - 0.04, halfDepth - 0.2],
    maxCorner: [0.02, height, halfDepth - 0.08],
    color: METAL,
  });
}

/** The seat's standard sitting height; the catalogue height is the tank's. */
const TOILET_SEAT_METERS = 0.42;

/** Bowl, seat and the tank against the wall. */
export function appendToilet(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const tankDepth = 0.16;
  const seatTop = Math.min(TOILET_SEAT_METERS, height * 0.55);
  const bowlRadius = Math.min(halfWidth, (halfDepth * 2 - tankDepth) * HALF) * 0.95;
  const bowlCenterZ = -halfDepth + bowlRadius + 0.02;

  appendVerticalCylinder(builder, {
    centerX: 0,
    centerZ: bowlCenterZ,
    radius: bowlRadius * 0.6,
    bottom: 0,
    top: seatTop - 0.1,
    color: PORCELAIN_SHADE,
  });
  appendVerticalCylinder(builder, {
    centerX: 0,
    centerZ: bowlCenterZ,
    radius: bowlRadius,
    bottom: seatTop - 0.1,
    top: seatTop,
    color: PORCELAIN,
  });
  // The tank, full width against the wall, its lid closing the piece's height.
  appendBox(builder, {
    minCorner: [-halfWidth, 0.1, halfDepth - tankDepth],
    maxCorner: [halfWidth, height - 0.04, halfDepth],
    color: PORCELAIN,
  });
  appendBox(builder, {
    minCorner: [-halfWidth, height - 0.04, halfDepth - tankDepth - 0.01],
    maxCorner: [halfWidth, height, halfDepth],
    color: PORCELAIN_SHADE,
  });
}

/** A tray, two glass screens on the open sides, the riser and its head. */
export function appendShower(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const trayHeight = 0.1;
  const glassThickness = 0.02;
  const glassHeight = height * 0.95;

  appendBox(builder, {
    minCorner: [-halfWidth, 0, -halfDepth],
    maxCorner: [halfWidth, trayHeight, halfDepth],
    color: PORCELAIN,
  });
  // Glass on the front and one side; the back and other side meet the walls.
  appendBox(builder, {
    minCorner: [-halfWidth, trayHeight, -halfDepth],
    maxCorner: [halfWidth, glassHeight, -halfDepth + glassThickness],
    color: GLASS,
  });
  appendBox(builder, {
    minCorner: [-halfWidth, trayHeight, -halfDepth],
    maxCorner: [-halfWidth + glassThickness, glassHeight, halfDepth],
    color: GLASS,
  });
  // The riser in the walled corner, the head reaching over the tray.
  appendBox(builder, {
    minCorner: [halfWidth - 0.06, trayHeight, halfDepth - 0.06],
    maxCorner: [halfWidth - 0.02, height, halfDepth - 0.02],
    color: METAL,
  });
  appendBox(builder, {
    minCorner: [halfWidth - 0.3, height - 0.04, halfDepth - 0.3],
    maxCorner: [halfWidth - 0.02, height, halfDepth - 0.02],
    color: METAL,
  });
}

/** Outer shell, a rim, and the water line inside. */
export function appendBathtub(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const rimThickness = 0.07;
  const rimTop = height;
  const innerBottom = 0.12;

  appendBox(builder, {
    minCorner: [-halfWidth, 0, -halfDepth],
    maxCorner: [halfWidth, rimTop - 0.02, halfDepth],
    color: PORCELAIN_SHADE,
  });
  // The rim runs the whole edge; the inside sits lower, read as water.
  appendRimmedTop(builder, {
    halfWidth,
    halfDepth,
    rimThickness,
    top: rimTop,
    innerY: rimTop - 0.12,
    rimColor: PORCELAIN,
  });
  appendBox(builder, {
    minCorner: [-halfWidth + rimThickness, innerBottom, -halfDepth + rimThickness],
    maxCorner: [halfWidth - rimThickness, rimTop - 0.12, halfDepth - rimThickness],
    color: WATER,
  });
}

/** The white cube with a porthole door and a controls strip. */
export function appendWashingMachine(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  appendBox(builder, {
    minCorner: [-halfWidth, 0, -halfDepth + 0.02],
    maxCorner: [halfWidth, height, halfDepth],
    color: APPLIANCE,
  });
  // The porthole: a dark disc standing just proud of the front.
  appendVerticalDiscOnFront(builder, {
    centerX: 0,
    centerY: height * 0.45,
    radius: Math.min(halfWidth, height * 0.45) * 0.62,
    frontZ: -halfDepth,
    thickness: 0.02,
    color: APPLIANCE_DARK,
  });
  appendBox(builder, {
    minCorner: [-halfWidth + 0.02, height - 0.12, -halfDepth - 0.005],
    maxCorner: [halfWidth - 0.02, height - 0.04, -halfDepth + 0.02],
    color: APPLIANCE_DARK,
  });
}

/** The vertical cylinder on the wall, pipes dropping below. */
export function appendBoiler(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const radius = Math.min(halfWidth, halfDepth);

  appendVerticalCylinder(builder, {
    centerX: 0,
    centerZ: 0,
    radius,
    bottom: height * 0.12,
    top: height,
    color: APPLIANCE,
  });

  for (const side of [-1, 1]) {
    appendBox(builder, {
      minCorner: [side * radius * 0.4 - 0.02, 0, -0.02],
      maxCorner: [side * radius * 0.4 + 0.02, height * 0.14, 0.02],
      color: METAL,
    });
  }
}

/** A thin panel with vertical fins — the section radiator under a window. */
export function appendRadiator(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const finCount = Math.max(6, Math.round((halfWidth * 2) / 0.08));
  const finWidth = (halfWidth * 2) / finCount;

  appendBox(builder, {
    minCorner: [-halfWidth, height - 0.06, -halfDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color: APPLIANCE,
  });
  appendBox(builder, {
    minCorner: [-halfWidth, 0.06, -halfDepth],
    maxCorner: [halfWidth, 0.12, halfDepth],
    color: APPLIANCE,
  });

  for (let index = 0; index < finCount; index += 1) {
    const left = -halfWidth + index * finWidth;

    appendBox(builder, {
      minCorner: [left + finWidth * 0.15, 0.08, -halfDepth + 0.005],
      maxCorner: [left + finWidth * 0.85, height - 0.04, halfDepth - 0.005],
      color: APPLIANCE,
    });
  }
}
