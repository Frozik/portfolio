import { describe, expect, it } from 'vitest';

import { createBuilding, storeysOf } from '../domain/model/building';
import { addDevice, assignDeviceToPanel } from '../domain/model/device-edits';
import { createCeilingLight, createWallDevice } from '../domain/model/electrical';
import { CONDUIT_FILL_LIMIT } from '../domain/model/installation';
import { addStoreyObject } from '../domain/model/storey-edits';
import { WIRING_ROUTE_OBJECTS } from '../domain/model/storey-objects';
import { addWall } from '../domain/model/wall-edits';
import { createWall } from '../domain/model/walls';
import { createWiringRoute } from '../domain/model/wiring-routes';
import { deriveWires } from './wire-scenes';
import { deriveWiringReport } from './wiring-report';

/** One wall along y = 8 with a panel and a socket on it, wired as one group. */
function wiredHouse() {
  const building = createBuilding({ name: 'Дом' });
  const [storey] = storeysOf(building);
  const wall = createWall({
    points: [
      { x: 0, y: 8 },
      { x: 10, y: 8 },
    ],
  });
  const panel = createWallDevice({ kind: 'panel', wallId: wall.id, offsetMeters: 1 });
  const outlet = createWallDevice({ kind: 'outlet', wallId: wall.id, offsetMeters: 9 });
  const light = createCeilingLight({ x: 5, y: 4 });
  let buildings = addWall([building], building.id, storey.id, wall);

  for (const device of [panel, outlet, light]) {
    buildings = addDevice(buildings, building.id, storey.id, device);
  }

  buildings = assignDeviceToPanel(buildings, building.id, panel.id, outlet.id);
  buildings = assignDeviceToPanel(buildings, building.id, panel.id, light.id);

  return { buildings, building, storeyId: storey.id, panel, outlet, light };
}

describe('deriveWiringReport', () => {
  it('measures each group with the drops at both ends and the cutting reserve', () => {
    const { buildings, building } = wiredHouse();
    const [storey] = storeysOf(buildings[0]);
    const wires = deriveWires(storey);
    const report = deriveWiringReport(storey, wires);

    expect(building.id).toBeDefined();
    expect(report.lines).toHaveLength(1);
    expect(report.lines[0].cableTypeId).toBe('vvg-3x2.5');
    expect(report.lines[0].consumerCount).toBe(2);
    // Socket run: 8 m along the wall plus the drops from the ceiling run to the
    // panel and to the socket. Light run: a 4 + 4 m dog-leg plus the panel's
    // drop alone — a ceiling light hangs at the run's own height.
    const runHeight = storey.heightMeters - 0.15;
    const raw = 8 + (runHeight - 1.5) + (runHeight - 0.3) + 8 + (runHeight - 1.5);

    expect(report.lines[0].lengthMeters).toBeCloseTo(raw * 1.1, 1);
    expect(report.deviceCounts.outlet).toBe(1);
  });

  it('counts the metres of every drawn stretch by its installation', () => {
    const { buildings, building, storeyId } = wiredHouse();
    const withRoute = addStoreyObject(
      buildings,
      building.id,
      storeyId,
      WIRING_ROUTE_OBJECTS,
      createWiringRoute({
        points: [
          { x: 0, y: 8 },
          { x: 10, y: 8 },
        ],
        installation: 'conduit-16',
      })
    );
    const [storey] = storeysOf(withRoute[0]);
    const report = deriveWiringReport(storey, deriveWires(storey));

    expect(report.installationMetersByPreset['conduit-16']).toBeCloseTo(10);
  });

  it('flags a conduit the cables riding it overfill', () => {
    const { buildings, building, storeyId } = wiredHouse();
    const withRoute = addStoreyObject(
      buildings,
      building.id,
      storeyId,
      WIRING_ROUTE_OBJECTS,
      createWiringRoute({
        points: [
          { x: 0, y: 8 },
          { x: 10, y: 8 },
        ],
        installation: 'conduit-16',
      })
    );
    const [storey] = storeysOf(withRoute[0]);
    const report = deriveWiringReport(storey, deriveWires(storey));

    // The socket's 2.5 mm² cable (≈68 mm²) alone fills three quarters of a
    // Ø16 bore (≈90 mm²); the light stands out of the route's reach.
    expect(report.overfilled).toHaveLength(1);
    expect(report.overfilled[0].fillRatio).toBeGreaterThan(CONDUIT_FILL_LIMIT);
  });
});
