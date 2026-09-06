import type { Building } from '../../model/building';
import { createBuilding } from '../../model/building';
import { createCeilingLight, createWallDevice } from '../../model/electrical';
import { createRectangle } from '../../model/shapes';
import { createStorey } from '../../model/storeys';
import { createWall } from '../../model/walls';
import { ring, furnitureAt, labelAt, opening, entries } from '../stock-house-parts';

/**
 * «Дачный дом 8 × 6»: гостиная-кухня, спальня и санузел, двускатная крыша.
 * The corner sits on the origin; instantiation recentres it anyway.
 */
export function dachaHouse(): Building {
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
