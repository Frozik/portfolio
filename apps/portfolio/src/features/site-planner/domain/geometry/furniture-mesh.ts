import { assertNever } from '@frozik/utils/assert/assertNever';

import type { FurnitureCatalogEntry } from '../model/furniture';
import type { PieceFrame } from './furniture-palette';
import { WOOD, WOOD_DARK, HALF } from './furniture-palette';
import {
  appendKitchenRun,
  appendFridge,
  appendStove,
  appendSink,
  appendToilet,
  appendShower,
  appendBathtub,
  appendWashingMachine,
  appendBoiler,
  appendRadiator,
} from './furniture-pieces-kitchen-bath';
import {
  appendBed,
  appendSofa,
  appendTable,
  appendDesk,
  appendChair,
  appendWingChair,
  appendOfficeChair,
  appendRoundTable,
} from './furniture-pieces-seating';
import {
  appendFrontedCabinet,
  appendDrawerCabinet,
  appendBookshelf,
  appendSlidingWardrobe,
  appendTvStand,
  appendCubeShelving,
} from './furniture-pieces-storage';
import type { ColoredMesh } from './lit-mesh';
import { createMeshBuilder, finishColoredMesh } from './mesh-builder';

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
