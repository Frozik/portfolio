import type { PieceFrame } from './furniture-palette';
import { WOOD, WOOD_DARK, LINEN, APPLIANCE_DARK, HALF } from './furniture-palette';
import type { MeshBuilder, Rgb } from './mesh-builder';
import { appendBox } from './mesh-builder';

/** What things are kept in: cabinets, shelves, wardrobes and the TV stand. */
/** A carcass with door faces standing a shade proud, split by a seam. */
export function appendFrontedCabinet(
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
export function appendDrawerCabinet(
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
export function appendBookshelf(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
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

/** The купе: two full-height sliding doors under a top rail. */
export function appendSlidingWardrobe(
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
export function appendTvStand(
  builder: MeshBuilder,
  { halfWidth, halfDepth, height }: PieceFrame
): void {
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
export function appendCubeShelving(
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

  for (const panelBottom of [0, height - panelThickness]) {
    appendBox(builder, {
      minCorner: [-halfWidth, panelBottom, -halfDepth],
      maxCorner: [halfWidth, panelBottom + panelThickness, halfDepth],
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
