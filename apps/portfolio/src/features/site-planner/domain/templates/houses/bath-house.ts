import type { Building } from '../../model/building';
import { createBuilding } from '../../model/building';
import { createDuct } from '../../model/ducts';
import { createCeilingLight, createWallDevice } from '../../model/electrical';
import { createFireplace } from '../../model/fireplaces';
import { createRectangle } from '../../model/shapes';
import { createStorey } from '../../model/storeys';
import { createWall } from '../../model/walls';
import { ring, furnitureAt, labelAt, opening, entries } from '../stock-house-parts';

/** «Баня 4 × 6»: парная с каменкой и вентшахтой, мойка и комната отдыха. */
export function bathHouse(): Building {
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
