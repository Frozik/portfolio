import { RESTRICTION_KIND, ROAD_CLASS } from './format';
import type { RoutingGraph } from './graph';
import { Router } from './router';
import { buildEdgeIndex, snapToEdge } from './snap';
import type { SnappedPoint } from './snap';
import { buildGrid, CAR_ONEWAY_ACCESS, GRID_STEP_DEGREES, GRID_STREETS } from './test-helper';

const SNAP_METRES = 50;

function snap(
  graph: RoutingGraph,
  lon: number,
  lat: number,
  profile: 'car' | 'foot' | 'bike'
): SnappedPoint {
  const point = snapToEdge(graph, buildEdgeIndex(graph), lon, lat, profile, SNAP_METRES);
  if (point === undefined) {
    throw new Error('nothing to snap to');
  }
  return point;
}

const BOTTOM_LEFT = { lon: 0.0001, lat: 0 };
const TOP_RIGHT = { lon: 2 * GRID_STEP_DEGREES - 0.0001, lat: GRID_STEP_DEGREES };

describe('Router', () => {
  it('finds the shortest way across the block and reports its length', () => {
    const { graph } = buildGrid(GRID_STREETS);
    const router = new Router(graph);
    const route = router.route(
      'car',
      snap(graph, BOTTOM_LEFT.lon, BOTTOM_LEFT.lat, 'car'),
      snap(graph, TOP_RIGHT.lon, TOP_RIGHT.lat, 'car')
    );

    expect(route).toBeDefined();
    // Three block sides minus the two partial ends: ≈ 300 m − 2 × 11 m.
    expect(route?.distanceMetres).toBeGreaterThan(270);
    expect(route?.distanceMetres).toBeLessThan(290);
    // Two equally long ways exist (via Middle or via Right); either is fine.
    expect([1, 2]).toContain(route?.edges.length);
    expect(route?.geometryLon[0]).toBeCloseTo(BOTTOM_LEFT.lon, 6);
    expect(route?.geometryLat.at(-1)).toBeCloseTo(TOP_RIGHT.lat, 6);
  });

  it('respects a oneway for cars and ignores it for pedestrians', () => {
    const streets = GRID_STREETS.map(street =>
      street.from === 1 && street.to === 2 ? { ...street, access: CAR_ONEWAY_ACCESS } : street
    );
    const { graph } = buildGrid(streets);
    const router = new Router(graph);
    const from = { lon: 2 * GRID_STEP_DEGREES - 0.0001, lat: 0 };
    const to = { lon: 0.0001, lat: 0 };

    const car = router.route(
      'car',
      snap(graph, from.lon, from.lat, 'car'),
      snap(graph, to.lon, to.lat, 'car')
    );
    const foot = router.route(
      'foot',
      snap(graph, from.lon, from.lat, 'foot'),
      snap(graph, to.lon, to.lat, 'foot')
    );

    // Both partial ends lie on Bottom, so no whole edge is needed on foot.
    expect(foot?.edges).toEqual([]);
    // The car has to go around the block: up, along the top, down.
    expect(car?.edges.length).toBe(3);
    expect(car?.distanceMetres).toBeGreaterThan((foot?.distanceMetres ?? 0) + 150);
  });

  it('obeys a no-turn restriction by taking the next street', () => {
    const { builder } = buildGrid(GRID_STREETS);
    // Coming from 0 → 1 along Bottom, turning onto Middle (1 → 4) is forbidden.
    builder.addRestriction({ fromEdge: 0, viaNode: 1, toEdge: 5, kind: RESTRICTION_KIND.no });
    const graph = builder.build();
    const router = new Router(graph);
    const from = { lon: 0.0001, lat: 0 };
    const to = { lon: GRID_STEP_DEGREES, lat: GRID_STEP_DEGREES - 0.0001 };

    const route = router.route(
      'car',
      snap(graph, from.lon, from.lat, 'car'),
      snap(graph, to.lon, to.lat, 'car')
    );

    expect(route).toBeDefined();
    expect(route?.edges.map(edge => edge.edge)).not.toContain(5);
  });

  it('walks along a single edge without entering the search', () => {
    const { graph } = buildGrid(GRID_STREETS);
    const router = new Router(graph);
    const route = router.route(
      'foot',
      snap(graph, 0.0002, 0, 'foot'),
      snap(graph, 0.0007, 0, 'foot')
    );

    expect(route?.edges).toEqual([]);
    expect(route?.settledStates).toBe(0);
    expect(route?.distanceMetres).toBeGreaterThan(50);
    expect(route?.distanceMetres).toBeLessThan(60);
  });

  it('prefers faster roads for cars and shorter ones for pedestrians', () => {
    const streets = GRID_STREETS.map(street => {
      if (street.name === 'Top') {
        return { ...street, roadClass: ROAD_CLASS.primary };
      }
      if (street.name === 'Bottom') {
        return { ...street, roadClass: ROAD_CLASS.livingStreet };
      }
      return street;
    });
    const { graph } = buildGrid(streets);
    const router = new Router(graph);
    const from = { lon: 0, lat: 0.0001 };
    const to = { lon: 2 * GRID_STEP_DEGREES, lat: 0.0001 };

    const car = router.route(
      'car',
      snap(graph, from.lon, from.lat, 'car'),
      snap(graph, to.lon, to.lat, 'car')
    );
    const foot = router.route(
      'foot',
      snap(graph, from.lon, from.lat, 'foot'),
      snap(graph, to.lon, to.lat, 'foot')
    );

    expect(foot?.edges.map(edge => graph.names[graph.edgeNameIndex[edge.edge]])).toEqual([
      'Bottom',
      'Bottom',
    ]);
    expect(car?.edges.map(edge => graph.names[graph.edgeNameIndex[edge.edge]])).toEqual([
      'Top',
      'Top',
    ]);
  });

  it('returns undefined when the destination is unreachable', () => {
    // Bottom and Top exist, nothing joins them.
    const { graph } = buildGrid(
      GRID_STREETS.filter(street => street.name === 'Bottom' || street.name === 'Top')
    );
    const router = new Router(graph);
    const route = router.route(
      'car',
      snap(graph, 0.0001, 0, 'car'),
      snap(graph, 0.0001, GRID_STEP_DEGREES, 'car')
    );
    expect(route).toBeUndefined();
  });
});
