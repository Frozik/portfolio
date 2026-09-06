import type { Building } from '../../model/building';
import { createBuilding } from '../../model/building';
import { createDuct } from '../../model/ducts';
import { createCeilingLight, createWallDevice } from '../../model/electrical';
import { createFireplace } from '../../model/fireplaces';
import { createRectangle } from '../../model/shapes';
import { createStair } from '../../model/stairs';
import { createStorey } from '../../model/storeys';
import { createSupport } from '../../model/supports';
import { createWall } from '../../model/walls';
import { ring, furnitureAt, labelAt, opening, entries } from '../stock-house-parts';

/**
 * «Особняк 12×11, два этажа»: та же полная программа в два уровня — внизу
 * гостиная, кухня с обеденной зоной и кладовой, сауна-кластер с помывочной и
 * зоной отдыха, котельная, прачечная и два санузла, веранда у входа; наверху
 * мастер-люкс (гардеробная → санузел, стол у окна), ещё две спальни и два
 * кабинета вдоль коридора.
 */
export function manor(): Building {
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
