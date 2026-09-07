import { decodePack, encodePack, PackFormatError } from './codec';
import { PACK_FORMAT_VERSION, RESTRICTION_KIND, ROAD_CLASS } from './format';
import { buildGrid, GRID_STREETS } from './test-helper';

describe('pack codec', () => {
  it('round-trips a graph with names, shapes and restrictions', () => {
    const { builder } = buildGrid(GRID_STREETS);
    builder.addEdge({
      from: 0,
      to: 5,
      access: 4,
      roadClass: ROAD_CLASS.footway,
      flags: 0,
      name: 'Диагональ',
      shape: [[0.0004, 0.0005]],
    });
    builder.addRestriction({ fromEdge: 0, viaNode: 1, toEdge: 5, kind: RESTRICTION_KIND.no });
    const graph = builder.build();

    const decoded = decodePack(encodePack(graph));

    expect(decoded.nodeCount).toBe(graph.nodeCount);
    expect(decoded.edgeCount).toBe(graph.edgeCount);
    expect(Array.from(decoded.nodeLon)).toEqual(Array.from(graph.nodeLon));
    expect(Array.from(decoded.nodeLat)).toEqual(Array.from(graph.nodeLat));
    expect(Array.from(decoded.edgeLengthCm)).toEqual(Array.from(graph.edgeLengthCm));
    expect(Array.from(decoded.edgeGeometryStart)).toEqual(Array.from(graph.edgeGeometryStart));
    expect(Array.from(decoded.geometryLat)).toEqual(Array.from(graph.geometryLat));
    expect(decoded.names).toEqual(['', 'Bottom', 'Top', 'Left', 'Middle', 'Right', 'Диагональ']);
    expect(Array.from(decoded.restrictionToEdge)).toEqual([5]);
    expect(Array.from(decoded.restrictionKind)).toEqual([RESTRICTION_KIND.no]);
  });

  it('rejects foreign bytes and packs from a newer format', () => {
    expect(() => decodePack(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(PackFormatError);

    const { graph } = buildGrid(GRID_STREETS);
    const bytes = encodePack(graph);
    new DataView(bytes.buffer).setUint32(4, PACK_FORMAT_VERSION + 1, true);
    expect(() => decodePack(bytes)).toThrow(/newer/);
  });
});
