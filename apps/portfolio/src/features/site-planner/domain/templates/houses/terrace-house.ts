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
 * «Дом с террасой 15.7×13.5» — по плану RuPlans (💬 картинка): H-образный
 * одноэтажный дом на 4 спальни в двух крыльях, каждое со своим санузлом и
 * коридором; в центре гостиная-кухня, к северу утопленная между крыльями
 * крытая терраса с камином (каменный дымоход рендера — flue за стеной), к югу
 * тамбур-блок (с/у, гардероб, прихожая, постирочная, бойлерная) и выступающее
 * крыльцо под свесом фронтона. Конёк двускатной крыши идёт поперёк дома, оба
 * фронтона накрывают террасу и крыльцо.
 */
export function terraceHouse(): Building {
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
