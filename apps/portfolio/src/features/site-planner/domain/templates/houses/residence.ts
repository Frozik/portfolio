import type { Building } from '../../model/building';
import { createBuilding } from '../../model/building';
import { createDuct } from '../../model/ducts';
import { createCeilingLight, createWallDevice } from '../../model/electrical';
import { createFireplace } from '../../model/fireplaces';
import { createRectangle } from '../../model/shapes';
import { createStorey } from '../../model/storeys';
import { createSupport } from '../../model/supports';
import { createWall } from '../../model/walls';
import { ring, furnitureAt, labelAt, opening, entries } from '../stock-house-parts';

/**
 * «Резиденция 19×12»: одноэтажная, полная программа — 3 спальни с мастер-люксом
 * (гардеробная → свой санузел, рабочий стол у окна), 2 кабинета, сауна-кластер
 * (парная, помывочная, зона отдыха), большая гостиная, кухня с зоной готовки,
 * обеденной зоной и кладовой, прачечная, котельная, гостевой санузел — и
 * крытая веранда перед входом: пятно выступает из-под стен, столбы держат
 * общий свес вальмовой крыши.
 */
export function residence(): Building {
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
