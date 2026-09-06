import type { Building } from '../../model/building';
import { createBuilding } from '../../model/building';
import { createCeilingLight, createWallDevice } from '../../model/electrical';
import { createRectangle } from '../../model/shapes';
import { createStorey } from '../../model/storeys';
import { ring, furnitureAt, labelAt, opening, entries } from '../stock-house-parts';

/** «Садовая студия 3 × 4»: панорамное окно, стол и кровать, свой свет. */
export function gardenStudio(): Building {
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
