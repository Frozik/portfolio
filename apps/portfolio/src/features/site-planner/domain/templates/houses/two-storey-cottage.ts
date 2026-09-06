import type { Building } from '../../model/building';
import { createBuilding } from '../../model/building';
import { createCeilingLight, createWallDevice } from '../../model/electrical';
import { createRectangle } from '../../model/shapes';
import { createStair } from '../../model/stairs';
import { createStorey } from '../../model/storeys';
import { createWall } from '../../model/walls';
import { ring, furnitureAt, labelAt, opening, entries } from '../stock-house-parts';

/**
 * «Коттедж 8 × 9, два этажа»: гостиная-кухня и санузел внизу, лестница,
 * две спальни наверху на своей плите, вальмовая крыша.
 */
export function twoStoreyCottage(): Building {
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
