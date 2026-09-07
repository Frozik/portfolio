import { buildEdgeIndex, snapToEdge } from './snap';
import { buildGrid, GRID_STEP_DEGREES, GRID_STREETS } from './test-helper';

describe('snapToEdge', () => {
  it('projects a point onto the nearest usable street with its fraction', () => {
    const { graph } = buildGrid(GRID_STREETS);
    const index = buildEdgeIndex(graph);
    const point = snapToEdge(graph, index, GRID_STEP_DEGREES * 0.25, 0.00002, 'car', 50);

    expect(point?.edge).toBe(0);
    expect(point?.fraction).toBeCloseTo(0.25, 2);
    expect(point?.distanceMetres).toBeLessThan(3);
    expect(point?.lat).toBeCloseTo(0, 6);
  });

  it('skips streets the profile may not use and gives up beyond the radius', () => {
    const { graph } = buildGrid(GRID_STREETS.map(street => ({ ...street, access: 4 | 8 })));
    const index = buildEdgeIndex(graph);

    expect(snapToEdge(graph, index, 0.0002, 0, 'car', 50)).toBeUndefined();
    expect(snapToEdge(graph, index, 0.0002, 0, 'foot', 50)?.edge).toBe(0);
    expect(snapToEdge(graph, index, 0.0002, 0.01, 'foot', 50)).toBeUndefined();
  });
});
