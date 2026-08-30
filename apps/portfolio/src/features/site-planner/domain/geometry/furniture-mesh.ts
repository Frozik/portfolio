import { assertNever } from '@frozik/utils/assert/assertNever';

import type { FurnitureCatalogEntry } from '../model/furniture';
import type { ColoredMesh } from './lit-mesh';
import type { LocalPoint, MeshBuilder, Rgb } from './mesh-builder';
import {
  appendBox,
  appendQuad,
  appendTriangle,
  createMeshBuilder,
  finishColoredMesh,
} from './mesh-builder';

/**
 * The furniture palette, one hue per material the pieces are made of. Wood and
 * porcelain echo the plan's furniture/plumbing fills, so a piece reads as the
 * same object in 2D and 3D.
 */
const WOOD: Rgb = [0.63, 0.48, 0.33];
const WOOD_DARK: Rgb = [0.5, 0.37, 0.25];
const FABRIC: Rgb = [0.45, 0.51, 0.62];
const FABRIC_DARK: Rgb = [0.36, 0.41, 0.5];
const LINEN: Rgb = [0.88, 0.88, 0.86];
const PORCELAIN: Rgb = [0.91, 0.93, 0.95];
const PORCELAIN_SHADE: Rgb = [0.78, 0.82, 0.86];
const APPLIANCE: Rgb = [0.85, 0.86, 0.88];
const APPLIANCE_DARK: Rgb = [0.2, 0.22, 0.26];
const METAL: Rgb = [0.65, 0.68, 0.72];
const GLASS: Rgb = [0.62, 0.76, 0.88];
const WATER: Rgb = [0.55, 0.72, 0.85];

const HALF = 0.5;
const CYLINDER_SEGMENT_COUNT = 10;
const FULL_TURN_RADIANS = 2 * Math.PI;

/**
 * The one model every placed piece of a catalogue row is drawn from: a
 * low-polygon body in the piece's own frame, in metres — width along `x`,
 * height up `y` from the floor at `y = 0`, and the FRONT towards `−z` (the
 * back at `+z` is the side the wall magnet parks against a wall). Every model
 * fills exactly the catalogue's width × depth × height box, which is what
 * keeps the 3D piece the same size as its 2D footprint and the real thing.
 */
export function buildFurnitureTemplate(entry: FurnitureCatalogEntry): ColoredMesh {
  const builder = createMeshBuilder();
  const frame: PieceFrame = {
    halfWidth: entry.widthMeters * HALF,
    halfDepth: entry.depthMeters * HALF,
    height: entry.heightMeters,
  };

  switch (entry.id) {
    case 'bed-double':
    case 'bed-160':
    case 'bed-single':
      appendBed(builder, frame);
      break;
    case 'sofa':
    case 'armchair':
      appendSofa(builder, frame);
      break;
    case 'armchair-wing':
      appendWingChair(builder, frame);
      break;
    case 'office-chair':
      appendOfficeChair(builder, frame);
      break;
    case 'table':
      appendTable(builder, frame, { legInset: 0.08 });
      break;
    case 'table-round':
      appendRoundTable(builder, frame);
      break;
    case 'coffee-table':
      appendTable(builder, frame, { legInset: 0.02 });
      break;
    case 'desk':
      appendDesk(builder, frame);
      break;
    case 'chair':
      appendChair(builder, frame);
      break;
    case 'wardrobe':
      appendFrontedCabinet(builder, frame, { doorCount: 2, color: WOOD, faceColor: WOOD_DARK });
      break;
    case 'wardrobe-tall':
      appendFrontedCabinet(builder, frame, { doorCount: 3, color: WOOD, faceColor: WOOD_DARK });
      break;
    case 'wardrobe-sliding':
      appendSlidingWardrobe(builder, frame);
      break;
    case 'dresser':
      appendDrawerCabinet(builder, frame, { drawerCount: 3 });
      break;
    case 'dresser-wide':
      appendDrawerCabinet(builder, frame, { drawerCount: 4, columnCount: 2 });
      break;
    case 'dresser-tall':
      appendDrawerCabinet(builder, frame, { drawerCount: 5 });
      break;
    case 'nightstand':
      appendDrawerCabinet(builder, frame, { drawerCount: 1 });
      break;
    case 'nightstand-tall':
      appendDrawerCabinet(builder, frame, { drawerCount: 3 });
      break;
    case 'tv-stand':
      appendTvStand(builder, frame);
      break;
    case 'bookshelf':
      appendBookshelf(builder, frame);
      break;
    case 'shelving-cube':
      appendCubeShelving(builder, frame);
      break;
    case 'kitchen-run':
      appendKitchenRun(builder, frame);
      break;
    case 'fridge':
      appendFridge(builder, frame);
      break;
    case 'stove':
      appendStove(builder, frame);
      break;
    case 'sink':
      appendSink(builder, frame);
      break;
    case 'toilet':
      appendToilet(builder, frame);
      break;
    case 'shower':
      appendShower(builder, frame);
      break;
    case 'bathtub':
      appendBathtub(builder, frame);
      break;
    case 'washing-machine':
      appendWashingMachine(builder, frame);
      break;
    case 'boiler':
      appendBoiler(builder, frame);
      break;
    case 'radiator':
      appendRadiator(builder, frame);
      break;
    default:
      assertNever(entry.id);
  }

  return finishColoredMesh(builder);
}

/** The catalogue box the model must fill, pre-halved where symmetry wants it. */
interface PieceFrame {
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly height: number;
}

/** Frame + мatress + pillows at the back, a blanket over the front two thirds. */
function appendBed(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendSofa(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendTable(
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
function appendDesk(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendChair(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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

/** A carcass with door faces standing a shade proud, split by a seam. */
function appendFrontedCabinet(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame,
  {
    doorCount,
    color,
    faceColor,
  }: { readonly doorCount: number; readonly color: Rgb; readonly faceColor: Rgb }
): void {
  const faceDepth = 0.02;

  appendBox(builder, {
    minCorner: [-halfWidth, 0, -halfDepth + faceDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color,
  });

  const doorWidth = (halfWidth * 2 - 0.04) / doorCount;

  for (let index = 0; index < doorCount; index += 1) {
    const left = -halfWidth + 0.02 + index * doorWidth;

    appendBox(builder, {
      minCorner: [left + 0.01, 0.02, -halfDepth],
      maxCorner: [left + doorWidth - 0.01, height - 0.02, -halfDepth + faceDepth],
      color: faceColor,
    });
  }
}

/** A carcass with drawer faces stacked up the front, columns across it. */
function appendDrawerCabinet(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame,
  { drawerCount, columnCount = 1 }: { readonly drawerCount: number; readonly columnCount?: number }
): void {
  const faceDepth = 0.02;

  appendBox(builder, {
    minCorner: [-halfWidth, 0, -halfDepth + faceDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color: WOOD,
  });

  const drawerHeight = (height - 0.06) / drawerCount;
  const columnWidth = (halfWidth * 2 - 0.04) / columnCount;

  for (let column = 0; column < columnCount; column += 1) {
    const left = -halfWidth + 0.02 + column * columnWidth;

    for (let index = 0; index < drawerCount; index += 1) {
      const bottom = 0.03 + index * drawerHeight;

      appendBox(builder, {
        minCorner: [left + 0.01, bottom + 0.01, -halfDepth],
        maxCorner: [
          left + columnWidth - 0.01,
          bottom + drawerHeight - 0.01,
          -halfDepth + faceDepth,
        ],
        color: WOOD_DARK,
      });
    }
  }
}

/** Two uprights, a back panel and open shelves. */
function appendBookshelf(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
  const panelThickness = 0.03;
  const shelfCount = 4;

  appendBox(builder, {
    minCorner: [-halfWidth, 0, halfDepth - panelThickness],
    maxCorner: [halfWidth, height, halfDepth],
    color: WOOD_DARK,
  });

  for (const side of [-1, 1]) {
    appendBox(builder, {
      minCorner: [side * halfWidth - (side > 0 ? panelThickness : 0), 0, -halfDepth],
      maxCorner: [side * halfWidth + (side > 0 ? 0 : panelThickness), height, halfDepth],
      color: WOOD,
    });
  }

  for (let index = 0; index <= shelfCount; index += 1) {
    const y = (height / shelfCount) * index;

    appendBox(builder, {
      minCorner: [-halfWidth + panelThickness, Math.max(y - panelThickness, 0), -halfDepth],
      maxCorner: [
        halfWidth - panelThickness,
        Math.max(y, panelThickness),
        halfDepth - panelThickness,
      ],
      color: WOOD,
    });
  }
}

/** Cabinets under a darker worktop, a sink bowl let into one end. */
function appendKitchenRun(
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
function appendFridge(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendStove(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendSink(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendToilet(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendShower(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendBathtub(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendWashingMachine(
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
function appendBoiler(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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
function appendRadiator(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
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

/** The wing chair: an armchair grown a tall back with side wings. */
function appendWingChair(builder: MeshBuilder, frame: PieceFrame): void {
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
function appendOfficeChair(
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
function appendRoundTable(
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

/** The купе: two full-height sliding doors under a top rail. */
function appendSlidingWardrobe(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const faceDepth = 0.025;

  appendBox(builder, {
    minCorner: [-halfWidth, 0, -halfDepth + faceDepth * 2],
    maxCorner: [halfWidth, height, halfDepth],
    color: WOOD,
  });
  // One door rides the outer track, the other the inner — the купе's overlap.
  appendBox(builder, {
    minCorner: [-halfWidth + 0.01, 0.02, -halfDepth],
    maxCorner: [0.02, height - 0.06, -halfDepth + faceDepth],
    color: WOOD_DARK,
  });
  appendBox(builder, {
    minCorner: [-0.02, 0.02, -halfDepth + faceDepth],
    maxCorner: [halfWidth - 0.01, height - 0.06, -halfDepth + faceDepth * 2],
    color: LINEN,
  });
  // The rail across the top the doors hang from.
  appendBox(builder, {
    minCorner: [-halfWidth, height - 0.06, -halfDepth],
    maxCorner: [halfWidth, height, halfDepth],
    color: WOOD_DARK,
  });
}

/** A low drawer cabinet with the television standing on it. */
function appendTvStand(builder: MeshBuilder, { halfWidth, halfDepth, height }: PieceFrame): void {
  const cabinetTop = height * 0.45;

  appendDrawerCabinet(
    builder,
    { halfWidth, halfDepth, height: cabinetTop },
    { drawerCount: 1, columnCount: 2 }
  );
  // The screen: a thin dark panel on a short foot, centred on the cabinet.
  appendBox(builder, {
    minCorner: [-0.08, cabinetTop, -0.02],
    maxCorner: [0.08, cabinetTop + 0.06, 0.06],
    color: APPLIANCE_DARK,
  });
  appendBox(builder, {
    minCorner: [-halfWidth * 0.72, cabinetTop + 0.06, 0],
    maxCorner: [halfWidth * 0.72, height, 0.04],
    color: APPLIANCE_DARK,
  });
}

/** The open cube shelving: a 2×2 grid of square cells. */
function appendCubeShelving(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
  const panelThickness = 0.035;

  // Back panel, sides, top and bottom close the frame.
  appendBox(builder, {
    minCorner: [-halfWidth, 0, halfDepth - panelThickness],
    maxCorner: [halfWidth, height, halfDepth],
    color: WOOD_DARK,
  });

  for (const side of [-1, 1]) {
    appendBox(builder, {
      minCorner: [side * halfWidth - (side > 0 ? panelThickness : 0), 0, -halfDepth],
      maxCorner: [side * halfWidth + (side > 0 ? 0 : panelThickness), height, halfDepth],
      color: WOOD,
    });
  }

  for (const y of [0, height - panelThickness]) {
    appendBox(builder, {
      minCorner: [-halfWidth, y, -halfDepth],
      maxCorner: [halfWidth, y + panelThickness, halfDepth],
      color: WOOD,
    });
  }

  // The cross: one shelf and one divider make the four cells, both stopping
  // at the frame so no face runs out flush with an outer one.
  appendBox(builder, {
    minCorner: [-halfWidth + panelThickness, height * HALF - panelThickness * HALF, -halfDepth],
    maxCorner: [
      halfWidth - panelThickness,
      height * HALF + panelThickness * HALF,
      halfDepth - panelThickness,
    ],
    color: WOOD,
  });
  appendBox(builder, {
    minCorner: [-panelThickness * HALF, panelThickness, -halfDepth],
    maxCorner: [panelThickness * HALF, height - panelThickness, halfDepth - panelThickness],
    color: WOOD,
  });
}

/** A closed vertical cylinder between two heights. */
function appendVerticalCylinder(
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
function appendFrustum(
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
function appendRimmedTop(
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
function appendVerticalDiscOnFront(
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
