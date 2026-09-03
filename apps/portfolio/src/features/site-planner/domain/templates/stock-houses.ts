import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BuildingTemplate } from '../model/building-template';
import { createDuct } from '../model/ducts';
import { createCeilingLight, createWallDevice } from '../model/electrical';
import { createFireplace } from '../model/fireplaces';
import type { UtilitySystem } from '../model/foundation';
import { createUtilityEntry, DEFAULT_FROST_DEPTH_METERS } from '../model/foundation';
import type { FurnitureCatalogId } from '../model/furniture';
import { createFurniture } from '../model/furniture';
import type { OpeningPreset } from '../model/openings';
import { createOpening } from '../model/openings';
import type { RoomTypeId } from '../model/rooms';
import { createRoomLabel } from '../model/rooms';
import { createRectangle } from '../model/shapes';
import type { Building } from '../model/site-plan';
import { createBuilding } from '../model/site-plan';
import { createStair } from '../model/stairs';
import { createStorey } from '../model/storeys';
import { createSupport } from '../model/supports';
import type { Wall } from '../model/walls';
import { createWall } from '../model/walls';

const ENTRY_SPACING = 3;

function ring(points: readonly Vector2[]): Wall {
  return { ...createWall({ points }), isClosed: true };
}

function furnitureAt(catalogId: FurnitureCatalogId, x: number, y: number, turn = 0) {
  return { ...createFurniture({ catalogId, position: { x, y } }), rotationDegrees: turn };
}

function labelAt(roomTypeId: RoomTypeId, x: number, y: number) {
  return createRoomLabel({ position: { x, y }, roomTypeId });
}

function opening(wall: Wall, preset: OpeningPreset, offsetMeters: number) {
  return createOpening({ wallId: wall.id, preset, offsetMeters });
}

function entries(systems: readonly UtilitySystem[]) {
  return systems.map((system, index) =>
    createUtilityEntry({
      system,
      outlineOffsetMeters: index * ENTRY_SPACING,
      frostDepthMeters: DEFAULT_FROST_DEPTH_METERS,
    })
  );
}

/**
 * «Дачный дом 8 × 6»: гостиная-кухня, спальня и санузел, двускатная крыша.
 * The corner sits on the origin; instantiation recentres it anyway.
 */
function dachaHouse(): Building {
  const shell = ring([
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 6 },
    { x: 0, y: 6 },
  ]);
  const partition = createWall({
    points: [
      { x: 3, y: 0 },
      { x: 3, y: 6 },
    ],
    material: 'frame',
  });
  const bathroomWall = createWall({
    points: [
      { x: 0, y: 3.8 },
      { x: 3, y: 3.8 },
    ],
    material: 'frame',
  });
  const storey = createStorey({
    heightMeters: 2.7,
    walls: [shell, partition, bathroomWall],
    openings: [
      opening(shell, 'door', 5.5),
      opening(shell, 'window', 11),
      opening(shell, 'window', 17),
      opening(shell, 'window', 26),
      opening(partition, 'door', 2),
      opening(partition, 'door', 4.9),
    ],
    roomLabels: [
      labelAt('living', 5.5, 3),
      labelAt('bedroom', 1.5, 1.8),
      labelAt('bathroom', 1.5, 4.9),
    ],
    furniture: [
      furnitureAt('sofa', 5.5, 5.2, 180),
      furnitureAt('table-round', 6.6, 2),
      furnitureAt('bed-double', 1.4, 1.5),
      furnitureAt('wardrobe', 2.5, 3.3, 90),
      furnitureAt('toilet', 0.4, 5.5, 90),
      furnitureAt('sink', 1.6, 5.6),
      furnitureAt('shower', 2.5, 5.5),
    ],
  });

  return {
    ...createBuilding({
      name: 'Дачный дом 8×6',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 4, y: 3 },
              width: 8,
              length: 6,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 2.7,
    storeys: [
      {
        ...storey,
        devices: [
          createCeilingLight({ x: 5.5, y: 3 }),
          createCeilingLight({ x: 1.5, y: 1.8 }),
          createCeilingLight({ x: 1.5, y: 4.9 }),
          createWallDevice({ kind: 'panel', wallId: shell.id, offsetMeters: 6.5 }),
          createWallDevice({ kind: 'switch', wallId: partition.id, offsetMeters: 2.6 }),
          createWallDevice({ kind: 'outlet', wallId: shell.id, offsetMeters: 12.5 }),
        ],
      },
    ],
    entries: entries(['power', 'water', 'sewer', 'gas']),
    pitchedRoof: { kind: 'gable', pitchDegrees: 30, overhangMeters: 0.5, ridgeDegrees: 0 },
  };
}

/** «Баня 4 × 6»: парная с каменкой и вентшахтой, мойка и комната отдыха. */
function bathHouse(): Building {
  const shell = ring([
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 4 },
    { x: 0, y: 4 },
  ]);
  const saunaWall = createWall({
    points: [
      { x: 2.2, y: 0 },
      { x: 2.2, y: 4 },
    ],
    material: 'timber',
  });
  const washWall = createWall({
    points: [
      { x: 3.8, y: 0 },
      { x: 3.8, y: 4 },
    ],
    material: 'timber',
  });
  const storey = createStorey({
    heightMeters: 2.3,
    walls: [shell, saunaWall, washWall],
    openings: [
      opening(shell, 'door', 4.9),
      opening(shell, 'window', 8),
      opening(saunaWall, 'door', 1),
      opening(washWall, 'door', 3),
    ],
    roomLabels: [labelAt('sauna', 1.1, 2), labelAt('bathroom', 3, 2), labelAt('living', 4.9, 2)],
    furniture: [furnitureAt('sofa', 4.9, 3.4, 180), furnitureAt('shower', 3, 3.5)],
  });

  return {
    ...createBuilding({
      name: 'Баня 6×4',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 3, y: 2 },
              width: 6,
              length: 4,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 2.3,
    storeys: [
      {
        ...storey,
        fireplaces: [createFireplace({ kind: 'saunaStove', position: { x: 0.6, y: 0.7 } })],
        ducts: [createDuct({ kind: 'vent', position: { x: 1.7, y: 3.5 } })],
        devices: [
          createCeilingLight({ x: 4.9, y: 2 }),
          createCeilingLight({ x: 3, y: 2 }),
          createWallDevice({ kind: 'panel', wallId: shell.id, offsetMeters: 5.6 }),
        ],
      },
    ],
    entries: entries(['power', 'water', 'sewer']),
    pitchedRoof: { kind: 'gable', pitchDegrees: 35, overhangMeters: 0.4, ridgeDegrees: 0 },
  };
}

/**
 * «Коттедж 8 × 9, два этажа»: гостиная-кухня и санузел внизу, лестница,
 * две спальни наверху на своей плите, вальмовая крыша.
 */
function twoStoreyCottage(): Building {
  const groundShell = ring([
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 9 },
    { x: 0, y: 9 },
  ]);
  const groundPartition = createWall({
    points: [
      { x: 0, y: 6 },
      { x: 3, y: 6 },
      { x: 3, y: 9 },
    ],
    material: 'frame',
  });
  const ground = createStorey({
    heightMeters: 2.8,
    walls: [groundShell, groundPartition],
    openings: [
      opening(groundShell, 'door', 5),
      opening(groundShell, 'window', 12),
      opening(groundShell, 'panoramic', 21),
      opening(groundPartition, 'door', 4.4),
    ],
    roomLabels: [
      labelAt('living', 5, 4.5),
      labelAt('bathroom', 1.4, 7.6),
      labelAt('hall', 1.5, 2.5),
    ],
    furniture: [
      furnitureAt('sofa', 5.6, 2.2, 180),
      furnitureAt('table', 4.6, 3.9),
      furnitureAt('toilet', 0.4, 8.4, 90),
      furnitureAt('sink', 2.2, 8.5),
    ],
  });
  const upperShell = ring([
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 9 },
    { x: 0, y: 9 },
  ]);
  const upperPartition = createWall({
    points: [
      { x: 4, y: 0 },
      { x: 4, y: 9 },
    ],
    material: 'frame',
  });
  const upper = createStorey({
    heightMeters: 2.6,
    walls: [upperShell, upperPartition],
    openings: [
      opening(upperShell, 'window', 4),
      opening(upperShell, 'window', 12.5),
      opening(upperShell, 'window', 21),
      opening(upperPartition, 'door', 4.5),
    ],
    roomLabels: [labelAt('bedroom', 2, 4.5), labelAt('bedroom', 6, 4.5)],
    furniture: [furnitureAt('bed-double', 1.8, 6.8), furnitureAt('bed-160', 6.2, 6.8)],
    slabs: [createRectangle({ center: { x: 4, y: 4.5 }, width: 8, length: 9, rotationDegrees: 0 })],
  });

  return {
    ...createBuilding({
      name: 'Коттедж 8×9, два этажа',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 4, y: 4.5 },
              width: 8,
              length: 9,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 2.8,
    storeys: [
      {
        ...ground,
        stairs: [
          createStair({ kind: 'l-shaped', position: { x: 6.2, y: 7 }, rotationDegrees: 180 }),
        ],
        devices: [
          createCeilingLight({ x: 5, y: 4.5 }),
          createCeilingLight({ x: 1.4, y: 7.6 }),
          createWallDevice({ kind: 'panel', wallId: groundShell.id, offsetMeters: 6 }),
        ],
      },
      {
        ...upper,
        devices: [createCeilingLight({ x: 2, y: 4.5 }), createCeilingLight({ x: 6, y: 4.5 })],
      },
    ],
    entries: entries(['power', 'water', 'sewer', 'gas']),
    pitchedRoof: { kind: 'hip', pitchDegrees: 28, overhangMeters: 0.5, ridgeDegrees: 90 },
  };
}

/** «Гараж 4 × 7»: ворота во всю ширину, верстак-стол, щиток и свет. */
function garage(): Building {
  const shell = ring([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 7 },
    { x: 0, y: 7 },
  ]);
  const storey = createStorey({
    heightMeters: 2.4,
    walls: [shell],
    openings: [opening(shell, 'panoramic', 2), opening(shell, 'window', 7.5)],
    roomLabels: [labelAt('garage', 2, 3.5)],
    furniture: [furnitureAt('desk', 2, 6.4, 180)],
  });

  return {
    ...createBuilding({
      name: 'Гараж 4×7',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 2, y: 3.5 },
              width: 4,
              length: 7,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 2.4,
    storeys: [
      {
        ...storey,
        devices: [
          createCeilingLight({ x: 2, y: 3.5 }),
          createWallDevice({ kind: 'panel', wallId: shell.id, offsetMeters: 4.6 }),
          createWallDevice({ kind: 'outlet', wallId: shell.id, offsetMeters: 10.5 }),
        ],
      },
    ],
    entries: entries(['power']),
    pitchedRoof: { kind: 'shed', pitchDegrees: 12, overhangMeters: 0.3, ridgeDegrees: 90 },
  };
}

/** «Садовая студия 3 × 4»: панорамное окно, стол и кровать, свой свет. */
function gardenStudio(): Building {
  const shell = ring([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ]);
  const storey = createStorey({
    heightMeters: 2.5,
    walls: [shell],
    openings: [opening(shell, 'door', 0.7), opening(shell, 'panoramic', 5.5)],
    roomLabels: [labelAt('living', 2, 1.5)],
    furniture: [furnitureAt('desk', 3.3, 0.5, 180), furnitureAt('bed-single', 0.8, 2.3, 90)],
  });

  return {
    ...createBuilding({
      name: 'Садовая студия 4×3',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 2, y: 1.5 },
              width: 4,
              length: 3,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 2.5,
    storeys: [
      {
        ...storey,
        devices: [
          createCeilingLight({ x: 2, y: 1.5 }),
          createWallDevice({ kind: 'panel', wallId: shell.id, offsetMeters: 1.4 }),
        ],
      },
    ],
    entries: entries(['power']),
    pitchedRoof: { kind: 'shed', pitchDegrees: 10, overhangMeters: 0.4, ridgeDegrees: 0 },
  };
}

/**
 * «Усадьба 15 × 10»: одноэтажная, полная программа семейного дома — тамбур-
 * прихожая со шкафом, просторная гостиная, отдельная столовая, кухня с
 * котельной и прачечной за ней, три спальни (мастер-люкс: гардеробная, свой
 * санузел, рабочий стол), общий санузел, сауна.
 */
function grangeHouse(): Building {
  const shell = ring([
    { x: 0, y: 0 },
    { x: 15, y: 0 },
    { x: 15, y: 10 },
    { x: 0, y: 10 },
  ]);
  const westSplit = createWall({
    points: [
      { x: 5.6, y: 0 },
      { x: 5.6, y: 10 },
    ],
    material: 'frame',
  });
  const bedroomsSplit = createWall({
    points: [
      { x: 0, y: 3.2 },
      { x: 5.6, y: 3.2 },
    ],
    material: 'frame',
  });
  const saunaBandWall = createWall({
    points: [
      { x: 0, y: 6.4 },
      { x: 5.6, y: 6.4 },
    ],
    material: 'frame',
  });
  const saunaWall = createWall({
    points: [
      { x: 2.6, y: 6.4 },
      { x: 2.6, y: 10 },
    ],
    material: 'timber',
  });
  const eastSplit = createWall({
    points: [
      { x: 5.6, y: 5.2 },
      { x: 15, y: 5.2 },
    ],
    material: 'frame',
  });
  const diningWall = createWall({
    points: [
      { x: 11, y: 0 },
      { x: 11, y: 5.2 },
    ],
    material: 'frame',
  });
  const kitchenWall = createWall({
    points: [
      { x: 11.4, y: 5.2 },
      { x: 11.4, y: 10 },
    ],
    material: 'frame',
  });
  const techBandWall = createWall({
    points: [
      { x: 11.4, y: 8 },
      { x: 15, y: 8 },
    ],
    material: 'frame',
  });
  const techSplitWall = createWall({
    points: [
      { x: 13.2, y: 8 },
      { x: 13.2, y: 10 },
    ],
    material: 'frame',
  });
  const hallWestWall = createWall({
    points: [
      { x: 6.8, y: 0 },
      { x: 6.8, y: 1.8 },
    ],
    material: 'frame',
  });
  const hallEastWall = createWall({
    points: [
      { x: 9.2, y: 0 },
      { x: 9.2, y: 1.8 },
    ],
    material: 'frame',
  });
  const hallTopWall = createWall({
    points: [
      { x: 6.8, y: 1.8 },
      { x: 9.2, y: 1.8 },
    ],
    material: 'frame',
  });
  const suiteBandWall = createWall({
    points: [
      { x: 5.6, y: 7.8 },
      { x: 9.2, y: 7.8 },
    ],
    material: 'frame',
  });
  const wardrobeWall = createWall({
    points: [
      { x: 7.4, y: 7.8 },
      { x: 7.4, y: 10 },
    ],
    material: 'frame',
  });
  const suiteBathWall = createWall({
    points: [
      { x: 9.2, y: 7.8 },
      { x: 9.2, y: 10 },
    ],
    material: 'frame',
  });
  const storey = createStorey({
    heightMeters: 2.9,
    walls: [
      shell,
      westSplit,
      bedroomsSplit,
      saunaBandWall,
      saunaWall,
      eastSplit,
      diningWall,
      kitchenWall,
      techBandWall,
      techSplitWall,
      hallWestWall,
      hallEastWall,
      hallTopWall,
      suiteBandWall,
      wardrobeWall,
      suiteBathWall,
    ],
    openings: [
      opening(shell, 'door', 8),
      opening(shell, 'window', 6.2),
      opening(shell, 'window', 13),
      opening(shell, 'window', 17.6),
      opening(shell, 'window', 21.4),
      opening(shell, 'window', 26.4),
      opening(shell, 'window', 29.8),
      opening(shell, 'window', 45.2),
      opening(shell, 'window', 48.4),
      opening(hallTopWall, 'door', 1.2),
      opening(westSplit, 'door', 1.6),
      opening(westSplit, 'door', 4.8),
      opening(westSplit, 'door', 8),
      opening(saunaWall, 'door', 1.6),
      opening(eastSplit, 'door', 1.2),
      opening(eastSplit, 'door', 7),
      opening(diningWall, 'panoramic', 2.6),
      opening(techBandWall, 'door', 0.9),
      opening(techBandWall, 'door', 2.7),
      opening(suiteBandWall, 'door', 0.9),
      opening(suiteBandWall, 'door', 2.7),
    ],
    roomLabels: [
      labelAt('hall', 8, 0.9),
      labelAt('living', 8.2, 3.4),
      labelAt('dining', 13, 2.6),
      labelAt('kitchen', 13.2, 6.6),
      labelAt('boiler', 12.3, 9),
      labelAt('laundry', 14.1, 9),
      labelAt('bedroom', 2.8, 1.6),
      labelAt('bedroom', 2.8, 4.8),
      labelAt('bedroom', 10.2, 6.4),
      labelAt('wardrobe', 6.5, 8.9),
      labelAt('bathroom', 8.3, 8.9),
      labelAt('bathroom', 4.1, 8.2),
      labelAt('sauna', 1.3, 8.2),
    ],
    furniture: [
      furnitureAt('wardrobe', 7.3, 1.4, 90),
      furnitureAt('sofa', 8, 4.5, 180),
      furnitureAt('armchair', 6.4, 3.6),
      furnitureAt('coffee-table', 7.8, 3.4),
      furnitureAt('table', 13, 2.6),
      furnitureAt('chair', 12.2, 1.6),
      furnitureAt('chair', 13.8, 1.6),
      furnitureAt('boiler', 11.8, 9.5),
      furnitureAt('washing-machine', 14.3, 9.5),
      furnitureAt('sink', 13.6, 9.6),
      furnitureAt('bed-double', 2.8, 1.4),
      furnitureAt('wardrobe', 4.7, 2.4, 90),
      furnitureAt('bed-160', 2.8, 4.5),
      furnitureAt('bed-double', 10.3, 6.3),
      furnitureAt('desk', 10.6, 5.7, 180),
      furnitureAt('office-chair', 10.6, 6.4),
      furnitureAt('toilet', 7.7, 9.5, 180),
      furnitureAt('sink', 8.8, 9.6),
      furnitureAt('toilet', 3, 9.5, 180),
      furnitureAt('bathtub', 4.4, 7, 0),
    ],
  });

  return {
    ...createBuilding({
      name: 'Усадьба 15×10, 3 спальни',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 7.5, y: 5 },
              width: 15,
              length: 10,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 2.9,
    storeys: [
      {
        ...storey,
        fireplaces: [createFireplace({ kind: 'saunaStove', position: { x: 0.6, y: 9.4 } })],
        ducts: [createDuct({ kind: 'vent', position: { x: 2.2, y: 6.9 } })],
        devices: [
          createCeilingLight({ x: 8, y: 0.9 }),
          createCeilingLight({ x: 8.2, y: 3.4 }),
          createCeilingLight({ x: 13, y: 2.6 }),
          createCeilingLight({ x: 13.2, y: 6.6 }),
          createCeilingLight({ x: 12.3, y: 9 }),
          createCeilingLight({ x: 14.1, y: 9 }),
          createCeilingLight({ x: 2.8, y: 1.6 }),
          createCeilingLight({ x: 2.8, y: 4.8 }),
          createCeilingLight({ x: 10.2, y: 6.4 }),
          createCeilingLight({ x: 4.1, y: 8.2 }),
          createWallDevice({ kind: 'panel', wallId: shell.id, offsetMeters: 9.6 }),
          createWallDevice({ kind: 'switch', wallId: westSplit.id, offsetMeters: 7.6 }),
          createWallDevice({ kind: 'outlet', wallId: shell.id, offsetMeters: 14.4 }),
        ],
      },
    ],
    entries: entries(['power', 'water', 'sewer', 'gas']),
    pitchedRoof: { kind: 'hip', pitchDegrees: 25, overhangMeters: 0.6, ridgeDegrees: 0 },
  };
}

/**
 * «Коттедж 10 × 9, два этажа»: внизу прихожая со шкафом, гостиная и
 * кухня-столовая, сауна, котельная и прачечная; наверху три спальни —
 * мастер со своей гардеробной, санузлом и столом — и лестничный холл.
 */
function familyCottage(): Building {
  const groundShell = ring([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 9 },
    { x: 0, y: 9 },
  ]);
  const groundSplit = createWall({
    points: [
      { x: 3.6, y: 0 },
      { x: 3.6, y: 9 },
    ],
    material: 'frame',
  });
  const hallWall = createWall({
    points: [
      { x: 0, y: 2.6 },
      { x: 3.6, y: 2.6 },
    ],
    material: 'frame',
  });
  const bathWall = createWall({
    points: [
      { x: 0, y: 4.6 },
      { x: 3.6, y: 4.6 },
    ],
    material: 'frame',
  });
  const saunaTopWall = createWall({
    points: [
      { x: 0, y: 7 },
      { x: 3.6, y: 7 },
    ],
    material: 'timber',
  });
  const techSplitWall = createWall({
    points: [
      { x: 1.8, y: 7 },
      { x: 1.8, y: 9 },
    ],
    material: 'frame',
  });
  const groundEastSplit = createWall({
    points: [
      { x: 3.6, y: 5 },
      { x: 10, y: 5 },
    ],
    material: 'frame',
  });
  const ground = createStorey({
    heightMeters: 2.8,
    walls: [
      groundShell,
      groundSplit,
      hallWall,
      bathWall,
      saunaTopWall,
      techSplitWall,
      groundEastSplit,
    ],
    openings: [
      opening(groundShell, 'door', 1.8),
      opening(groundShell, 'window', 6),
      opening(groundShell, 'window', 12.5),
      opening(groundShell, 'window', 17),
      opening(groundShell, 'window', 23),
      opening(groundShell, 'window', 27.5),
      opening(groundSplit, 'door', 1.4),
      opening(groundSplit, 'door', 3.6),
      opening(groundSplit, 'door', 5.8),
      opening(groundSplit, 'door', 7.4),
      opening(groundSplit, 'door', 8.5),
      opening(groundEastSplit, 'panoramic', 2.6),
    ],
    roomLabels: [
      labelAt('hall', 1.6, 1.3),
      labelAt('bathroom', 1.6, 3.6),
      labelAt('sauna', 1.6, 5.8),
      labelAt('boiler', 0.9, 8),
      labelAt('laundry', 2.7, 8),
      labelAt('living', 6.8, 2.6),
      labelAt('dining', 6.8, 7),
    ],
    furniture: [
      furnitureAt('wardrobe', 0.9, 0.35, 0),
      furnitureAt('sofa', 7.2, 3.9, 180),
      furnitureAt('coffee-table', 7, 2.9),
      furnitureAt('table', 5, 7.2),
      furnitureAt('chair', 4.3, 6.4),
      furnitureAt('chair', 5.7, 6.4),
      furnitureAt('toilet', 0.4, 4.1, 90),
      furnitureAt('sink', 2.6, 4.2),
      furnitureAt('boiler', 0.5, 8.5),
      furnitureAt('washing-machine', 2.4, 8.5),
    ],
  });
  const upperShell = ring([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 9 },
    { x: 0, y: 9 },
  ]);
  const upperBand = createWall({
    points: [
      { x: 0, y: 4.8 },
      { x: 10, y: 4.8 },
    ],
    material: 'frame',
  });
  const suiteEastWall = createWall({
    points: [
      { x: 6, y: 0 },
      { x: 6, y: 4.8 },
    ],
    material: 'frame',
  });
  const upperNorthSplit = createWall({
    points: [
      { x: 4.4, y: 4.8 },
      { x: 4.4, y: 9 },
    ],
    material: 'frame',
  });
  const suiteWardrobeWall = createWall({
    points: [
      { x: 1.8, y: 0 },
      { x: 1.8, y: 2.4 },
    ],
    material: 'frame',
  });
  const suiteBathWall = createWall({
    points: [
      { x: 3.6, y: 0 },
      { x: 3.6, y: 2.4 },
    ],
    material: 'frame',
  });
  const suiteInnerBand = createWall({
    points: [
      { x: 0, y: 2.4 },
      { x: 3.6, y: 2.4 },
    ],
    material: 'frame',
  });
  const upper = createStorey({
    heightMeters: 2.6,
    walls: [
      upperShell,
      upperBand,
      suiteEastWall,
      upperNorthSplit,
      suiteWardrobeWall,
      suiteBathWall,
      suiteInnerBand,
    ],
    openings: [
      opening(upperShell, 'window', 4.8),
      opening(upperShell, 'window', 8),
      opening(upperShell, 'window', 12.5),
      opening(upperShell, 'window', 22),
      opening(upperShell, 'window', 27),
      opening(upperShell, 'window', 31.4),
      opening(upperBand, 'door', 4.6),
      opening(upperBand, 'door', 8),
      opening(upperNorthSplit, 'door', 1.6),
      opening(suiteInnerBand, 'door', 0.9),
      opening(suiteInnerBand, 'door', 2.7),
    ],
    roomLabels: [
      labelAt('bedroom', 4.6, 3.6),
      labelAt('wardrobe', 0.9, 1.2),
      labelAt('bathroom', 2.7, 1.2),
      labelAt('bedroom', 8, 2.4),
      labelAt('bedroom', 2.2, 6.9),
      labelAt('hall', 7.2, 6.9),
    ],
    furniture: [
      furnitureAt('bed-double', 4.7, 3.5),
      furnitureAt('desk', 5.5, 0.6, 180),
      furnitureAt('office-chair', 5.5, 1.4),
      furnitureAt('wardrobe', 0.9, 0.4, 0),
      furnitureAt('toilet', 2.1, 0.4, 0),
      furnitureAt('sink', 3.2, 0.5),
      furnitureAt('bed-160', 8, 2.2),
      furnitureAt('bed-single', 1.2, 6.6, 90),
      furnitureAt('dresser', 3.8, 8.5),
    ],
    slabs: [
      createRectangle({ center: { x: 5, y: 4.5 }, width: 10, length: 9, rotationDegrees: 0 }),
    ],
  });

  return {
    ...createBuilding({
      name: 'Коттедж 10×9, 3 спальни',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 5, y: 4.5 },
              width: 10,
              length: 9,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 2.8,
    storeys: [
      {
        ...ground,
        stairs: [
          createStair({ kind: 'l-shaped', position: { x: 8.2, y: 6.9 }, rotationDegrees: 180 }),
        ],
        fireplaces: [createFireplace({ kind: 'saunaStove', position: { x: 0.5, y: 6.5 } })],
        ducts: [createDuct({ kind: 'vent', position: { x: 3, y: 6.6 } })],
        devices: [
          createCeilingLight({ x: 6.8, y: 2.6 }),
          createCeilingLight({ x: 6.8, y: 7 }),
          createCeilingLight({ x: 1.6, y: 3.6 }),
          createCeilingLight({ x: 1.6, y: 1.3 }),
          createCeilingLight({ x: 0.9, y: 8 }),
          createCeilingLight({ x: 2.7, y: 8 }),
          createWallDevice({ kind: 'panel', wallId: groundShell.id, offsetMeters: 0.6 }),
          createWallDevice({ kind: 'switch', wallId: groundSplit.id, offsetMeters: 1 }),
        ],
      },
      {
        ...upper,
        devices: [
          createCeilingLight({ x: 4.6, y: 3.6 }),
          createCeilingLight({ x: 8, y: 2.4 }),
          createCeilingLight({ x: 2.2, y: 6.9 }),
          createCeilingLight({ x: 7.2, y: 6.9 }),
        ],
      },
    ],
    entries: entries(['power', 'water', 'sewer', 'gas']),
    pitchedRoof: { kind: 'gable', pitchDegrees: 32, overhangMeters: 0.5, ridgeDegrees: 90 },
  };
}

/** Every stock house the «Готовый дом» dialog offers, in its listed order. */
/**
 * «Резиденция 19×12»: одноэтажная, полная программа — 3 спальни с мастер-люксом
 * (гардеробная → свой санузел, рабочий стол у окна), 2 кабинета, сауна-кластер
 * (парная, помывочная, зона отдыха), большая гостиная, кухня с зоной готовки,
 * обеденной зоной и кладовой, прачечная, котельная, гостевой санузел — и
 * крытая веранда перед входом: пятно выступает из-под стен, столбы держат
 * общий свес вальмовой крыши.
 */
function residence(): Building {
  const shell = ring([
    { x: 0, y: 0 },
    { x: 19, y: 0 },
    { x: 19, y: 12 },
    { x: 0, y: 12 },
  ]);
  const corridorSouth = createWall({
    points: [
      { x: 0, y: 7.4 },
      { x: 19, y: 7.4 },
    ],
    material: 'frame',
  });
  const corridorNorth = createWall({
    points: [
      { x: 0, y: 8.4 },
      { x: 19, y: 8.4 },
    ],
    material: 'frame',
  });
  const northVerticals = [3.2, 6.0, 8.8, 10.4, 11.8, 15.4, 17.2].map(x =>
    createWall({
      points: [
        { x, y: 8.4 },
        { x, y: 12 },
      ],
      material: 'frame',
    })
  );
  const westSplit = createWall({
    points: [
      { x: 5.6, y: 0 },
      { x: 5.6, y: 7.4 },
    ],
    material: 'frame',
  });
  const bedroomSplit = createWall({
    points: [
      { x: 0, y: 3.7 },
      { x: 5.6, y: 3.7 },
    ],
    material: 'frame',
  });
  const saunaBand = createWall({
    points: [
      { x: 0, y: 5.2 },
      { x: 3.8, y: 5.2 },
    ],
    material: 'timber',
  });
  const saunaWall = createWall({
    points: [
      { x: 2.2, y: 5.2 },
      { x: 2.2, y: 7.4 },
    ],
    material: 'timber',
  });
  const washWall = createWall({
    points: [
      { x: 3.8, y: 5.2 },
      { x: 3.8, y: 7.4 },
    ],
    material: 'timber',
  });
  const hallWest = createWall({
    points: [
      { x: 7.6, y: 0 },
      { x: 7.6, y: 2.2 },
    ],
    material: 'frame',
  });
  const hallEast = createWall({
    points: [
      { x: 10.4, y: 0 },
      { x: 10.4, y: 2.2 },
    ],
    material: 'frame',
  });
  const hallTop = createWall({
    points: [
      { x: 7.6, y: 2.2 },
      { x: 10.4, y: 2.2 },
    ],
    material: 'frame',
  });
  const wcTop = createWall({
    points: [
      { x: 5.6, y: 2.2 },
      { x: 7.6, y: 2.2 },
    ],
    material: 'frame',
  });
  const closetTop = createWall({
    points: [
      { x: 10.4, y: 2.2 },
      { x: 12.4, y: 2.2 },
    ],
    material: 'frame',
  });
  const eastSplit = createWall({
    points: [
      { x: 12.4, y: 0 },
      { x: 12.4, y: 7.4 },
    ],
    material: 'frame',
  });
  const pantryWest = createWall({
    points: [
      { x: 17, y: 0 },
      { x: 17, y: 2.2 },
    ],
    material: 'frame',
  });
  const pantryTop = createWall({
    points: [
      { x: 17, y: 2.2 },
      { x: 19, y: 2.2 },
    ],
    material: 'frame',
  });
  const storey = createStorey({
    heightMeters: 3,
    walls: [
      shell,
      corridorSouth,
      corridorNorth,
      ...northVerticals,
      westSplit,
      bedroomSplit,
      saunaBand,
      saunaWall,
      washWall,
      hallWest,
      hallEast,
      hallTop,
      wcTop,
      closetTop,
      eastSplit,
      pantryWest,
      pantryTop,
    ],
    openings: [
      opening(shell, 'door', 9),
      opening(shell, 'window', 2.6),
      opening(shell, 'window', 15),
      opening(shell, 'window', 22),
      opening(shell, 'window', 25.5),
      opening(shell, 'window', 35.8),
      opening(shell, 'window', 37.4),
      opening(shell, 'window', 40.4),
      opening(shell, 'window', 42.6),
      opening(shell, 'window', 45.4),
      opening(shell, 'window', 48.4),
      opening(shell, 'window', 51.8),
      opening(shell, 'window', 55.7),
      opening(shell, 'window', 57.6),
      opening(shell, 'window', 60.2),
      opening(corridorSouth, 'door', 7.5),
      opening(corridorSouth, 'door', 11),
      opening(corridorSouth, 'door', 16),
      opening(corridorNorth, 'door', 1.6),
      opening(corridorNorth, 'door', 4.6),
      opening(corridorNorth, 'door', 7.4),
      opening(corridorNorth, 'door', 13.6),
      opening(corridorNorth, 'door', 16.3),
      opening(corridorNorth, 'door', 18.1),
      opening(northVerticals[4], 'door', 2.2),
      opening(northVerticals[3], 'door', 2.2),
      opening(westSplit, 'door', 2),
      opening(westSplit, 'door', 4.5),
      opening(saunaBand, 'door', 1.1),
      opening(saunaBand, 'door', 3),
      opening(hallTop, 'door', 1.4),
      opening(wcTop, 'door', 1),
      opening(closetTop, 'door', 1),
      opening(eastSplit, 'door', 4.6),
      opening(pantryWest, 'door', 1.1),
    ],
    roomLabels: [
      labelAt('hall', 9, 1.1),
      labelAt('bathroom', 6.6, 1.1),
      labelAt('wardrobe', 11.4, 1.1),
      labelAt('living', 9, 4.8),
      labelAt('kitchen', 15.5, 4.5),
      labelAt('pantry', 18, 1.1),
      labelAt('hall', 9.5, 7.9),
      labelAt('bedroom', 2.8, 1.8),
      labelAt('living', 4.7, 6.3),
      labelAt('sauna', 1.1, 6.3),
      labelAt('bathroom', 3, 6.3),
      labelAt('bedroom', 1.6, 10.2),
      labelAt('office', 4.6, 10.2),
      labelAt('office', 7.4, 10.2),
      labelAt('bathroom', 9.6, 10.2),
      labelAt('wardrobe', 11.1, 10.2),
      labelAt('bedroom', 13.6, 10.2),
      labelAt('laundry', 16.3, 10.2),
      labelAt('boiler', 18.1, 10.2),
      labelAt('veranda', 9, -1.3),
    ],
    furniture: [
      furnitureAt('dresser', 8.2, 0.4),
      furnitureAt('wardrobe-sliding', 11.4, 0.5),
      furnitureAt('toilet', 6, 0.5),
      furnitureAt('sink', 7.2, 0.6),
      furnitureAt('sofa', 9, 6.6, 180),
      furnitureAt('armchair', 6.9, 5, 90),
      furnitureAt('armchair', 11.1, 5, 270),
      furnitureAt('coffee-table', 9, 5.4),
      furnitureAt('tv-stand', 9, 2.7),
      furnitureAt('kitchen-run', 14.2, 0.35),
      furnitureAt('stove', 15.3, 0.35),
      furnitureAt('sink', 13.2, 0.35),
      furnitureAt('fridge', 16.4, 0.35),
      furnitureAt('table', 15.5, 4.6),
      furnitureAt('chair', 14.7, 3.8),
      furnitureAt('chair', 16.3, 3.8),
      furnitureAt('chair', 14.7, 5.4, 180),
      furnitureAt('chair', 16.3, 5.4, 180),
      furnitureAt('shelving-cube', 18.5, 0.5),
      furnitureAt('shelving-cube', 17.4, 1.7, 90),
      furnitureAt('bed-160', 2.8, 1.5),
      furnitureAt('wardrobe', 4.8, 2.9, 90),
      furnitureAt('nightstand', 1.5, 0.6),
      furnitureAt('sofa', 4.7, 7, 180),
      furnitureAt('coffee-table', 4.7, 6),
      furnitureAt('armchair', 1.5, 4.4),
      furnitureAt('shower', 3, 7),
      furnitureAt('sink', 3, 5.7),
      furnitureAt('bed-double', 1.6, 10.6),
      furnitureAt('nightstand', 0.4, 11.6),
      furnitureAt('wardrobe', 2.7, 11.5),
      furnitureAt('desk', 4.6, 11.5, 180),
      furnitureAt('office-chair', 4.6, 10.7),
      furnitureAt('bookshelf', 3.6, 8.8),
      furnitureAt('desk', 7.4, 11.5, 180),
      furnitureAt('office-chair', 7.4, 10.7),
      furnitureAt('bookshelf', 6.4, 8.8),
      furnitureAt('toilet', 9.2, 11.5, 180),
      furnitureAt('sink', 10, 11.6),
      furnitureAt('shower', 9.2, 8.9),
      furnitureAt('wardrobe-sliding', 11.1, 11.4),
      furnitureAt('dresser', 11.1, 8.9),
      furnitureAt('bed-double', 14, 11),
      furnitureAt('nightstand', 12.9, 11.6),
      furnitureAt('nightstand', 15.1, 11.6),
      furnitureAt('desk', 12.4, 8.9),
      furnitureAt('office-chair', 12.4, 9.7, 180),
      furnitureAt('washing-machine', 15.9, 11.5),
      furnitureAt('sink', 16.8, 11.6),
      furnitureAt('boiler', 17.7, 11.5),
      furnitureAt('table-round', 8.2, -1.3),
      furnitureAt('chair', 7.4, -2),
      furnitureAt('chair', 9, -2),
      furnitureAt('chair', 8.2, -0.6, 180),
      furnitureAt('armchair', 11, -1.4),
    ],
  });

  return {
    ...createBuilding({
      name: 'Резиденция 19×12, 3 спальни и 2 кабинета',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 9.5, y: 6 },
              width: 19,
              length: 12,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
          {
            operand: createRectangle({
              center: { x: 9, y: -1.3 },
              width: 6.8,
              length: 2.6,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 3,
    storeys: [
      {
        ...storey,
        supports: [
          createSupport({ position: { x: 6.1, y: -2.1 } }),
          createSupport({ position: { x: 11.9, y: -2.1 } }),
        ],
        fireplaces: [createFireplace({ kind: 'saunaStove', position: { x: 0.5, y: 7 } })],
        ducts: [createDuct({ kind: 'vent', position: { x: 1.6, y: 7 } })],
        devices: [
          createCeilingLight({ x: 9, y: 1.1 }),
          createCeilingLight({ x: 9, y: 4.8 }),
          createCeilingLight({ x: 15.5, y: 4.5 }),
          createCeilingLight({ x: 9.5, y: 7.9 }),
          createCeilingLight({ x: 13.6, y: 10.2 }),
          createCeilingLight({ x: 4.6, y: 10.2 }),
          createCeilingLight({ x: 7.4, y: 10.2 }),
          createCeilingLight({ x: 4.7, y: 6.3 }),
          createWallDevice({ kind: 'panel', wallId: shell.id, offsetMeters: 32 }),
          createWallDevice({ kind: 'switch', wallId: corridorSouth.id, offsetMeters: 7.7 }),
          createWallDevice({ kind: 'outlet', wallId: shell.id, offsetMeters: 14.5 }),
        ],
      },
    ],
    entries: entries(['power', 'network', 'water', 'sewer', 'gas']),
    pitchedRoof: { kind: 'hip', pitchDegrees: 22, overhangMeters: 0.6, ridgeDegrees: 0 },
  };
}

/**
 * «Особняк 12×11, два этажа»: та же полная программа в два уровня — внизу
 * гостиная, кухня с обеденной зоной и кладовой, сауна-кластер с помывочной и
 * зоной отдыха, котельная, прачечная и два санузла, веранда у входа; наверху
 * мастер-люкс (гардеробная → санузел, стол у окна), ещё две спальни и два
 * кабинета вдоль коридора.
 */
function manor(): Building {
  const gShell = ring([
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: 12, y: 11 },
    { x: 0, y: 11 },
  ]);
  const gWestSplit = createWall({
    points: [
      { x: 4.9, y: 0 },
      { x: 4.9, y: 11 },
    ],
    material: 'frame',
  });
  const clusterSouth = createWall({
    points: [
      { x: 0, y: 6.4 },
      { x: 4.9, y: 6.4 },
    ],
    material: 'frame',
  });
  const saunaBand = createWall({
    points: [
      { x: 0, y: 8.8 },
      { x: 3.4, y: 8.8 },
    ],
    material: 'timber',
  });
  const saunaWall = createWall({
    points: [
      { x: 2, y: 8.8 },
      { x: 2, y: 11 },
    ],
    material: 'timber',
  });
  const washWall = createWall({
    points: [
      { x: 3.4, y: 8.8 },
      { x: 3.4, y: 11 },
    ],
    material: 'timber',
  });
  const hallEast = createWall({
    points: [
      { x: 7.5, y: 0 },
      { x: 7.5, y: 2.4 },
    ],
    material: 'frame',
  });
  const hallTop = createWall({
    points: [
      { x: 4.9, y: 2.4 },
      { x: 7.5, y: 2.4 },
    ],
    material: 'frame',
  });
  const bathEast = createWall({
    points: [
      { x: 9.3, y: 0 },
      { x: 9.3, y: 2.4 },
    ],
    material: 'frame',
  });
  const bathTop = createWall({
    points: [
      { x: 7.5, y: 2.4 },
      { x: 9.3, y: 2.4 },
    ],
    material: 'frame',
  });
  const closetTop = createWall({
    points: [
      { x: 9.3, y: 2.4 },
      { x: 12, y: 2.4 },
    ],
    material: 'frame',
  });
  const pantryWest = createWall({
    points: [
      { x: 10, y: 2.4 },
      { x: 10, y: 4.4 },
    ],
    material: 'frame',
  });
  const pantryTop = createWall({
    points: [
      { x: 10, y: 4.4 },
      { x: 12, y: 4.4 },
    ],
    material: 'frame',
  });
  const serviceBand = createWall({
    points: [
      { x: 4.9, y: 7.6 },
      { x: 12, y: 7.6 },
    ],
    material: 'frame',
  });
  const boilerWall = createWall({
    points: [
      { x: 7.2, y: 7.6 },
      { x: 7.2, y: 11 },
    ],
    material: 'frame',
  });
  const laundryWall = createWall({
    points: [
      { x: 9.5, y: 7.6 },
      { x: 9.5, y: 11 },
    ],
    material: 'frame',
  });
  const ground = createStorey({
    heightMeters: 2.9,
    walls: [
      gShell,
      gWestSplit,
      clusterSouth,
      saunaBand,
      saunaWall,
      washWall,
      hallEast,
      hallTop,
      bathEast,
      bathTop,
      closetTop,
      pantryWest,
      pantryTop,
      serviceBand,
      boilerWall,
      laundryWall,
    ],
    openings: [
      opening(gShell, 'door', 6.2),
      opening(gShell, 'window', 2.5),
      opening(gShell, 'window', 17.8),
      opening(gShell, 'window', 21),
      opening(gShell, 'window', 26.7),
      opening(gShell, 'window', 29),
      opening(gShell, 'window', 38.6),
      opening(gShell, 'panoramic', 42.4),
      opening(gWestSplit, 'door', 1.2),
      opening(clusterSouth, 'door', 2.4),
      opening(saunaBand, 'door', 1),
      opening(saunaBand, 'door', 2.7),
      opening(hallTop, 'door', 1.6),
      opening(hallEast, 'door', 1.2),
      opening(closetTop, 'door', 1.3),
      opening(pantryWest, 'door', 1),
      opening(serviceBand, 'door', 0.9),
      opening(serviceBand, 'door', 3.2),
      opening(serviceBand, 'door', 5.5),
    ],
    roomLabels: [
      labelAt('living', 2.5, 3.2),
      labelAt('hall', 6.2, 1.2),
      labelAt('bathroom', 8.4, 1.2),
      labelAt('wardrobe', 10.6, 1.2),
      labelAt('kitchen', 7.5, 5.8),
      labelAt('pantry', 11, 3.4),
      labelAt('boiler', 6, 9.3),
      labelAt('laundry', 8.3, 9.3),
      labelAt('bathroom', 10.7, 9.3),
      labelAt('sauna', 1, 9.9),
      labelAt('bathroom', 2.7, 9.9),
      labelAt('living', 2.4, 7.6),
      labelAt('veranda', 6, -1.2),
    ],
    furniture: [
      furnitureAt('sofa', 2.4, 5.6, 180),
      furnitureAt('armchair', 1, 3.6, 90),
      furnitureAt('coffee-table', 2.4, 4.6),
      furnitureAt('tv-stand', 2.4, 0.5),
      furnitureAt('dresser', 5.4, 0.4),
      furnitureAt('toilet', 7.9, 0.5),
      furnitureAt('sink', 8.9, 0.6),
      furnitureAt('wardrobe-sliding', 10.6, 0.5),
      furnitureAt('kitchen-run', 6.2, 7.2, 180),
      furnitureAt('stove', 7.3, 7.2, 180),
      furnitureAt('sink', 5.2, 7.2, 180),
      furnitureAt('fridge', 8.4, 7.2, 180),
      furnitureAt('table', 7.2, 4.6),
      furnitureAt('chair', 6.4, 3.8),
      furnitureAt('chair', 8, 3.8),
      furnitureAt('chair', 6.4, 5.4, 180),
      furnitureAt('chair', 8, 5.4, 180),
      furnitureAt('shelving-cube', 11.5, 2.8),
      furnitureAt('shelving-cube', 10.4, 3.9, 90),
      furnitureAt('boiler', 5.3, 10.5),
      furnitureAt('washing-machine', 7.6, 10.5),
      furnitureAt('sink', 8.6, 10.6),
      furnitureAt('toilet', 9.9, 10.5, 180),
      furnitureAt('sink', 10.9, 10.6),
      furnitureAt('bathtub', 10.8, 8.2),
      furnitureAt('sofa', 2.4, 8.3, 180),
      furnitureAt('coffee-table', 2.4, 7.4),
      furnitureAt('shower', 2.7, 10.5),
      furnitureAt('sink', 2.7, 9.2),
      furnitureAt('table-round', 5.2, -1.2),
      furnitureAt('chair', 4.4, -1.9),
      furnitureAt('chair', 6, -1.9),
      furnitureAt('chair', 5.2, -0.5, 180),
      furnitureAt('armchair', 7.8, -1.3),
    ],
  });
  const uShell = ring([
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: 12, y: 11 },
    { x: 0, y: 11 },
  ]);
  const corridorSouth = createWall({
    points: [
      { x: 0, y: 4.8 },
      { x: 12, y: 4.8 },
    ],
    material: 'frame',
  });
  const corridorNorth = createWall({
    points: [
      { x: 0, y: 6 },
      { x: 12, y: 6 },
    ],
    material: 'frame',
  });
  const southVerticals = [3.1, 6.2, 9.3].map(x =>
    createWall({
      points: [
        { x, y: 0 },
        { x, y: 4.8 },
      ],
      material: 'frame',
    })
  );
  const northVerticals = [4.4, 5.8, 7.6, 9.4].map(x =>
    createWall({
      points: [
        { x, y: 6 },
        { x, y: 11 },
      ],
      material: 'frame',
    })
  );
  const upper = createStorey({
    heightMeters: 2.7,
    walls: [uShell, corridorSouth, corridorNorth, ...southVerticals, ...northVerticals],
    openings: [
      opening(uShell, 'window', 1.5),
      opening(uShell, 'window', 4.6),
      opening(uShell, 'window', 7.7),
      opening(uShell, 'window', 10.6),
      opening(uShell, 'window', 14.4),
      opening(uShell, 'window', 20.5),
      opening(uShell, 'window', 24.3),
      opening(uShell, 'window', 26.5),
      opening(uShell, 'window', 32.8),
      opening(uShell, 'window', 37.5),
      opening(uShell, 'window', 43.6),
      opening(corridorSouth, 'door', 1.5),
      opening(corridorSouth, 'door', 4.6),
      opening(corridorSouth, 'door', 7.7),
      opening(corridorSouth, 'door', 10.6),
      opening(corridorNorth, 'door', 2.2),
      opening(corridorNorth, 'door', 8.5),
      opening(corridorNorth, 'door', 10.7),
      opening(northVerticals[0], 'door', 2.5),
      opening(northVerticals[1], 'door', 2.5),
    ],
    roomLabels: [
      labelAt('office', 1.5, 2.4),
      labelAt('office', 4.6, 2.4),
      labelAt('bedroom', 7.7, 2.4),
      labelAt('hall', 10.6, 2.4),
      labelAt('hall', 6, 5.4),
      labelAt('bedroom', 2.2, 8.5),
      labelAt('wardrobe', 5.1, 8.5),
      labelAt('bathroom', 6.7, 8.5),
      labelAt('bathroom', 8.5, 8.5),
      labelAt('bedroom', 10.7, 8.5),
    ],
    furniture: [
      furnitureAt('desk', 1.5, 0.5),
      furnitureAt('office-chair', 1.5, 1.3, 180),
      furnitureAt('bookshelf', 2.6, 4.3, 180),
      furnitureAt('desk', 4.6, 0.5),
      furnitureAt('office-chair', 4.6, 1.3, 180),
      furnitureAt('bed-160', 7.7, 1),
      furnitureAt('wardrobe', 8.7, 4.2, 180),
      furnitureAt('bed-double', 2.2, 9.2),
      furnitureAt('nightstand', 1.1, 10.5),
      furnitureAt('nightstand', 3.3, 10.5),
      furnitureAt('desk', 1, 6.5),
      furnitureAt('office-chair', 1, 7.3, 180),
      furnitureAt('wardrobe-sliding', 5.1, 10.4),
      furnitureAt('dresser', 5.1, 6.6),
      furnitureAt('toilet', 6.3, 10.5, 180),
      furnitureAt('sink', 7.1, 10.6),
      furnitureAt('shower', 6.4, 6.6),
      furnitureAt('toilet', 8.1, 10.5, 180),
      furnitureAt('sink', 8.9, 10.6),
      furnitureAt('bathtub', 8.5, 7.2),
      furnitureAt('bed-double', 10.7, 9),
      furnitureAt('nightstand', 9.9, 10.4),
      furnitureAt('wardrobe', 11.2, 6.6),
    ],
    slabs: [
      createRectangle({ center: { x: 6, y: 5.5 }, width: 12, length: 11, rotationDegrees: 0 }),
    ],
  });

  return {
    ...createBuilding({
      name: 'Особняк 12×11, два этажа',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 6, y: 5.5 },
              width: 12,
              length: 11,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
          {
            operand: createRectangle({
              center: { x: 6, y: -1.2 },
              width: 6.8,
              length: 2.4,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 2.9,
    storeys: [
      {
        ...ground,
        stairs: [
          createStair({ kind: 'l-shaped', position: { x: 10.2, y: 6.9 }, rotationDegrees: 180 }),
        ],
        supports: [
          createSupport({ position: { x: 3.1, y: -1.9 } }),
          createSupport({ position: { x: 8.9, y: -1.9 } }),
        ],
        fireplaces: [createFireplace({ kind: 'saunaStove', position: { x: 0.5, y: 10.6 } })],
        ducts: [createDuct({ kind: 'vent', position: { x: 1.6, y: 10.7 } })],
        devices: [
          createCeilingLight({ x: 2.5, y: 3.2 }),
          createCeilingLight({ x: 7.2, y: 5.2 }),
          createCeilingLight({ x: 6.2, y: 1.2 }),
          createCeilingLight({ x: 2.4, y: 7.6 }),
          createWallDevice({ kind: 'panel', wallId: gShell.id, offsetMeters: 29.5 }),
          createWallDevice({ kind: 'switch', wallId: hallTop.id, offsetMeters: 0.5 }),
          createWallDevice({ kind: 'outlet', wallId: gShell.id, offsetMeters: 17 }),
        ],
      },
      {
        ...upper,
        devices: [
          createCeilingLight({ x: 6, y: 5.4 }),
          createCeilingLight({ x: 2.2, y: 8.5 }),
          createCeilingLight({ x: 1.5, y: 2.4 }),
          createCeilingLight({ x: 4.6, y: 2.4 }),
        ],
      },
    ],
    entries: entries(['power', 'network', 'water', 'sewer', 'gas']),
    pitchedRoof: { kind: 'gable', pitchDegrees: 32, overhangMeters: 0.5, ridgeDegrees: 0 },
  };
}

/**
 * «Дом с террасой 15.7×13.5» — по плану RuPlans (💬 картинка): H-образный
 * одноэтажный дом на 4 спальни в двух крыльях, каждое со своим санузлом и
 * коридором; в центре гостиная-кухня, к северу утопленная между крыльями
 * крытая терраса с камином (каменный дымоход рендера — flue за стеной), к югу
 * тамбур-блок (с/у, гардероб, прихожая, постирочная, бойлерная) и выступающее
 * крыльцо под свесом фронтона. Конёк двускатной крыши идёт поперёк дома, оба
 * фронтона накрывают террасу и крыльцо.
 */
function terraceHouse(): Building {
  const shell = ring([
    { x: 0, y: 0 },
    { x: 15.72, y: 0 },
    { x: 15.72, y: 13.47 },
    { x: 11.65, y: 13.47 },
    { x: 11.65, y: 11.82 },
    { x: 4.07, y: 11.82 },
    { x: 4.07, y: 13.47 },
    { x: 0, y: 13.47 },
  ]);
  const leftWingSplit = createWall({
    points: [
      { x: 4.07, y: 0 },
      { x: 4.07, y: 11.82 },
    ],
    material: 'frame',
  });
  const rightWingSplit = createWall({
    points: [
      { x: 11.65, y: 0 },
      { x: 11.65, y: 11.82 },
    ],
    material: 'frame',
  });
  const leftBedroomFloor = createWall({
    points: [
      { x: 0, y: 9.1 },
      { x: 4.07, y: 9.1 },
    ],
    material: 'frame',
  });
  const leftBandFloor = createWall({
    points: [
      { x: 0, y: 5.9 },
      { x: 4.07, y: 5.9 },
    ],
    material: 'frame',
  });
  const leftBathWall = createWall({
    points: [
      { x: 2.25, y: 5.9 },
      { x: 2.25, y: 9.1 },
    ],
    material: 'frame',
  });
  const rightBedroomFloor = createWall({
    points: [
      { x: 11.65, y: 9.1 },
      { x: 15.72, y: 9.1 },
    ],
    material: 'frame',
  });
  const rightBandFloor = createWall({
    points: [
      { x: 11.65, y: 5.9 },
      { x: 15.72, y: 5.9 },
    ],
    material: 'frame',
  });
  const rightBathWall = createWall({
    points: [
      { x: 13.47, y: 5.9 },
      { x: 13.47, y: 9.1 },
    ],
    material: 'frame',
  });
  const entryBandTop = createWall({
    points: [
      { x: 4.07, y: 4 },
      { x: 11.65, y: 4 },
    ],
    material: 'frame',
  });
  const entryWest = createWall({
    points: [
      { x: 6.85, y: 0 },
      { x: 6.85, y: 4 },
    ],
    material: 'frame',
  });
  const entryEast = createWall({
    points: [
      { x: 8.85, y: 0 },
      { x: 8.85, y: 4 },
    ],
    material: 'frame',
  });
  const wcSplit = createWall({
    points: [
      { x: 4.07, y: 2.1 },
      { x: 6.85, y: 2.1 },
    ],
    material: 'frame',
  });
  const boilerSplit = createWall({
    points: [
      { x: 8.85, y: 2.1 },
      { x: 11.65, y: 2.1 },
    ],
    material: 'frame',
  });
  const storey = createStorey({
    heightMeters: 3,
    walls: [
      shell,
      leftWingSplit,
      rightWingSplit,
      leftBedroomFloor,
      leftBandFloor,
      leftBathWall,
      rightBedroomFloor,
      rightBandFloor,
      rightBathWall,
      entryBandTop,
      entryWest,
      entryEast,
      wcSplit,
      boilerSplit,
    ],
    openings: [
      opening(shell, 'door', 7.85),
      opening(shell, 'window', 2),
      opening(shell, 'window', 13.8),
      opening(shell, 'window', 17.7),
      opening(shell, 'window', 26.7),
      opening(shell, 'window', 31.2),
      opening(shell, 'panoramic', 37.2),
      opening(shell, 'door', 40.3),
      opening(shell, 'window', 46.2),
      opening(shell, 'window', 50.7),
      opening(shell, 'window', 59.2),
      opening(leftWingSplit, 'door', 7.5),
      opening(rightWingSplit, 'door', 7.5),
      opening(leftBedroomFloor, 'door', 3.2),
      opening(leftBandFloor, 'door', 3.2),
      opening(leftBathWall, 'door', 1.7),
      opening(rightBedroomFloor, 'door', 0.85),
      opening(rightBandFloor, 'door', 0.85),
      opening(rightBathWall, 'door', 1.7),
      opening(entryBandTop, 'door', 3.78),
      opening(entryWest, 'door', 1.1),
      opening(entryWest, 'door', 3.1),
      opening(entryEast, 'door', 1.1),
      opening(entryEast, 'door', 3.1),
    ],
    roomLabels: [
      labelAt('bedroom', 2, 11.3),
      labelAt('bathroom', 1.1, 7.5),
      labelAt('hall', 3.1, 7.5),
      labelAt('bedroom', 2, 2.9),
      labelAt('bedroom', 13.8, 11.3),
      labelAt('bathroom', 14.6, 7.5),
      labelAt('hall', 12.5, 7.5),
      labelAt('bedroom', 13.8, 2.9),
      labelAt('living', 6.5, 8),
      labelAt('kitchen', 10.3, 9.5),
      labelAt('veranda', 7.86, 12.6),
      labelAt('hall', 7.85, 2),
      labelAt('bathroom', 5.5, 3.1),
      labelAt('wardrobe', 5.5, 1.05),
      labelAt('laundry', 10.2, 3.1),
      labelAt('boiler', 10.2, 1.05),
      labelAt('veranda', 7.86, -0.6),
    ],
    furniture: [
      furnitureAt('bed-double', 2, 11.6),
      furnitureAt('nightstand', 0.5, 12.6),
      furnitureAt('wardrobe', 3.3, 9.6, 180),
      furnitureAt('bed-160', 2, 1.2),
      furnitureAt('wardrobe', 1, 5.3, 180),
      furnitureAt('bathtub', 1.1, 6.6),
      furnitureAt('toilet', 0.5, 8.6, 90),
      furnitureAt('sink', 1.7, 8.7),
      furnitureAt('bed-double', 13.8, 11.6),
      furnitureAt('nightstand', 15.2, 12.6),
      furnitureAt('wardrobe', 12.4, 9.6, 180),
      furnitureAt('bed-160', 13.8, 1.2),
      furnitureAt('wardrobe', 14.8, 5.3, 180),
      furnitureAt('bathtub', 14.6, 6.6),
      furnitureAt('toilet', 15.2, 8.6, 270),
      furnitureAt('sink', 14, 8.7),
      furnitureAt('sofa', 5.6, 8.6, 90),
      furnitureAt('coffee-table', 6.6, 8.6),
      furnitureAt('tv-stand', 6.5, 4.6),
      furnitureAt('table', 8.9, 8.4),
      furnitureAt('chair', 8.1, 7.6),
      furnitureAt('chair', 9.7, 7.6),
      furnitureAt('chair', 8.1, 9.2, 180),
      furnitureAt('chair', 9.7, 9.2, 180),
      furnitureAt('kitchen-run', 10.2, 11.4, 180),
      furnitureAt('stove', 11.2, 11.4, 180),
      furnitureAt('sink', 9.3, 11.4, 180),
      furnitureAt('fridge', 11.3, 10.3, 270),
      furnitureAt('toilet', 4.6, 3.5, 90),
      furnitureAt('sink', 5.9, 3.6),
      furnitureAt('dresser', 7.85, 0.4),
      furnitureAt('wardrobe-sliding', 4.7, 0.6, 270),
      furnitureAt('shelving-cube', 6.4, 1.6, 90),
      furnitureAt('washing-machine', 9.3, 3.6),
      furnitureAt('sink', 10.3, 3.6),
      furnitureAt('boiler', 9.3, 0.5),
      furnitureAt('table-round', 7, 12.7),
      furnitureAt('chair', 6.2, 12.2),
      furnitureAt('chair', 7.8, 12.2),
      furnitureAt('armchair', 9.5, 12.6, 180),
    ],
  });

  return {
    ...createBuilding({
      name: 'Дом с террасой 15.7×13.5, 4 спальни',
      composition: {
        terms: [
          {
            operand: createRectangle({
              center: { x: 7.86, y: 6.735 },
              width: 15.72,
              length: 13.47,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
          {
            operand: createRectangle({
              center: { x: 7.86, y: -0.6 },
              width: 3.51,
              length: 1.2,
              rotationDegrees: 0,
            }),
            operation: 'union',
          },
        ],
      },
    }),
    wallHeight: 3,
    storeys: [
      {
        ...storey,
        supports: [
          createSupport({ position: { x: 4.6, y: 13.1 } }),
          createSupport({ position: { x: 11.1, y: 13.1 } }),
          createSupport({ position: { x: 6.35, y: -1 } }),
          createSupport({ position: { x: 9.35, y: -1 } }),
        ],
        fireplaces: [createFireplace({ kind: 'fireplace', position: { x: 7.6, y: 11.3 } })],
        ducts: [createDuct({ kind: 'flue', position: { x: 8.3, y: 11.3 } })],
        devices: [
          createCeilingLight({ x: 6.5, y: 8 }),
          createCeilingLight({ x: 10.3, y: 9.5 }),
          createCeilingLight({ x: 7.85, y: 2 }),
          createCeilingLight({ x: 2, y: 11.3 }),
          createCeilingLight({ x: 2, y: 2.9 }),
          createCeilingLight({ x: 13.8, y: 11.3 }),
          createCeilingLight({ x: 13.8, y: 2.9 }),
          createWallDevice({ kind: 'panel', wallId: entryEast.id, offsetMeters: 0.5 }),
          createWallDevice({ kind: 'switch', wallId: entryBandTop.id, offsetMeters: 3.3 }),
          createWallDevice({ kind: 'outlet', wallId: shell.id, offsetMeters: 36.3 }),
        ],
      },
    ],
    entries: entries(['power', 'water', 'sewer', 'gas']),
    pitchedRoof: { kind: 'gable', pitchDegrees: 27, overhangMeters: 0.6, ridgeDegrees: 90 },
  };
}

export const STOCK_HOUSE_TEMPLATES: readonly BuildingTemplate[] = [
  { id: 'terrace-house-16x13', building: terraceHouse() },
  { id: 'residence-19x12', building: residence() },
  { id: 'manor-12x11', building: manor() },
  { id: 'grange-15x10', building: grangeHouse() },
  { id: 'family-cottage-10x9', building: familyCottage() },
  { id: 'cottage-8x9', building: twoStoreyCottage() },
  { id: 'dacha-8x6', building: dachaHouse() },
  { id: 'bath-6x4', building: bathHouse() },
  { id: 'garage-4x7', building: garage() },
  { id: 'studio-4x3', building: gardenStudio() },
];

export function findStockHouseTemplate(id: string): BuildingTemplate | undefined {
  return STOCK_HOUSE_TEMPLATES.find(template => template.id === id);
}
