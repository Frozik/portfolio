import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ACCESS_BIT, RESTRICTION_KIND } from '@frozik/navigation-pack/format';
import { Router } from '@frozik/navigation-pack/router';
import { buildEdgeIndex, snapToEdge } from '@frozik/navigation-pack/snap';

import type { OsmNode, OsmRelation, OsmWay } from '../pbf/osm-pbf-reader';
import { encodeTestPbf, tags } from '../pbf/test-helper';
import { buildRoutingGraph } from './build-graph';

/**
 *   1 ─ 2 ─ 3      way A: 1-2-3 (residential, node 2 is a plain bend)
 *       │          way B: 2-5   (service) — makes node 2 a junction
 *   4 ─ 5 ─ 6      way C: 4-5-6 (residential, oneway east)
 */
function writeFixture(relations: readonly OsmRelation[] = []): string {
  const nodes: OsmNode[] = [
    { id: 1, lon: 55.27, lat: 25.19, tags: tags({}) },
    { id: 2, lon: 55.271, lat: 25.19, tags: tags({}) },
    { id: 3, lon: 55.272, lat: 25.19, tags: tags({}) },
    { id: 4, lon: 55.27, lat: 25.189, tags: tags({}) },
    { id: 5, lon: 55.271, lat: 25.189, tags: tags({}) },
    { id: 6, lon: 55.272, lat: 25.189, tags: tags({}) },
    { id: 99, lon: 55.3, lat: 25.3, tags: tags({ amenity: 'cafe' }) },
  ];
  const ways: OsmWay[] = [
    { id: 100, refs: [1, 2, 3], tags: tags({ highway: 'residential', name: 'North' }) },
    { id: 200, refs: [2, 5], tags: tags({ highway: 'service' }) },
    {
      id: 300,
      refs: [4, 5, 6],
      tags: tags({ highway: 'residential', name: 'South', oneway: 'yes' }),
    },
    { id: 400, refs: [1, 4], tags: tags({ building: 'yes' }) },
  ];
  const path = join(mkdtempSync(join(tmpdir(), 'nav-graph-')), 'fixture.osm.pbf');
  writeFileSync(path, encodeTestPbf(nodes, ways, relations));
  return path;
}

describe('buildRoutingGraph', () => {
  it('keeps only highways, splits ways at junctions and collapses bends into geometry', () => {
    const { graph, stats } = buildRoutingGraph(writeFixture());

    expect(stats.waysRead).toBe(4);
    expect(stats.routableWays).toBe(3);
    // Nodes 1, 2, 3, 4, 5, 6 are routing nodes: 2 and 5 are junctions, the rest endpoints.
    expect(graph.nodeCount).toBe(6);
    // North splits at node 2 (1-2, 2-3), Link 2-5, South splits at node 5 (4-5, 5-6).
    expect(graph.edgeCount).toBe(5);
    const south = [...graph.edgeNameIndex]
      .map((name, edge) => ({ name: graph.names[name], edge }))
      .filter(entry => entry.name === 'South');
    expect(south).toHaveLength(2);
    expect(graph.edgeAccess[south[0].edge] & ACCESS_BIT.carBackward).toBe(0);
    expect(graph.edgeAccess[south[0].edge] & ACCESS_BIT.footBackward).not.toBe(0);
  });

  it('turns a no_left_turn relation into an edge restriction the router obeys', () => {
    const relation: OsmRelation = {
      id: 1,
      members: [
        { type: 'way', ref: 100, role: 'from' },
        { type: 'node', ref: 2, role: 'via' },
        { type: 'way', ref: 200, role: 'to' },
      ],
      tags: tags({ type: 'restriction', restriction: 'no_left_turn' }),
    };
    const { graph, stats } = buildRoutingGraph(writeFixture([relation]));
    expect(stats.restrictionsApplied).toBe(1);
    expect(Array.from(graph.restrictionKind)).toEqual([RESTRICTION_KIND.no]);

    const router = new Router(graph);
    const index = buildEdgeIndex(graph);
    // From near node 1 heading to node 5: the direct turn at 2 onto the link is forbidden
    // and no other way exists, so the car cannot get there at all.
    const origin = snapToEdge(graph, index, 55.2702, 25.19, 'car', 100);
    const destination = snapToEdge(graph, index, 55.271, 25.1892, 'car', 100);
    expect(origin).toBeDefined();
    expect(destination).toBeDefined();
    if (origin !== undefined && destination !== undefined) {
      expect(router.route('car', origin, destination)).toBeUndefined();
      // Coming the other way (from node 3) the turn is allowed.
      const fromEast = snapToEdge(graph, index, 55.2718, 25.19, 'car', 100);
      expect(fromEast).toBeDefined();
      if (fromEast !== undefined) {
        expect(router.route('car', fromEast, destination)).toBeDefined();
      }
    }
  });
});
