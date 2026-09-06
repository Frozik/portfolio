import type { Building } from '../../model/building';
import { createBuilding } from '../../model/building';
import { createDuct } from '../../model/ducts';
import { createCeilingLight, createWallDevice } from '../../model/electrical';
import { createFireplace } from '../../model/fireplaces';
import { createRectangle } from '../../model/shapes';
import { createStair } from '../../model/stairs';
import { createStorey } from '../../model/storeys';
import { createWall } from '../../model/walls';
import { ring, furnitureAt, labelAt, opening, entries } from '../stock-house-parts';

/**
 * «Коттедж 10 × 9, два этажа»: внизу прихожая со шкафом, гостиная и
 * кухня-столовая, сауна, котельная и прачечная; наверху три спальни —
 * мастер со своей гардеробной, санузлом и столом — и лестничный холл.
 */
export function familyCottage(): Building {
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
