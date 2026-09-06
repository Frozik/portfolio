import type { Building } from '../../model/building';
import { createBuilding } from '../../model/building';
import { createCeilingLight, createWallDevice } from '../../model/electrical';
import { createRectangle } from '../../model/shapes';
import { createStorey } from '../../model/storeys';
import { ring, furnitureAt, labelAt, opening, entries } from '../stock-house-parts';

/** «Гараж 4 × 7»: ворота во всю ширину, верстак-стол, щиток и свет. */
export function garage(): Building {
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
