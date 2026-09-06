import type { Building } from '../../model/building';
import { createBuilding } from '../../model/building';
import { createDuct } from '../../model/ducts';
import { createCeilingLight, createWallDevice } from '../../model/electrical';
import { createFireplace } from '../../model/fireplaces';
import { createRectangle } from '../../model/shapes';
import { createStorey } from '../../model/storeys';
import { createWall } from '../../model/walls';
import { ring, furnitureAt, labelAt, opening, entries } from '../stock-house-parts';

/**
 * «Усадьба 15 × 10»: одноэтажная, полная программа семейного дома — тамбур-
 * прихожая со шкафом, просторная гостиная, отдельная столовая, кухня с
 * котельной и прачечной за ней, три спальни (мастер-люкс: гардеробная, свой
 * санузел, рабочий стол), общий санузел, сауна.
 */
export function grangeHouse(): Building {
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
