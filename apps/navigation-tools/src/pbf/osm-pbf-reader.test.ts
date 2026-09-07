import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { OsmNode, OsmRelation, OsmWay } from './osm-pbf-reader';
import { readOsmPbf } from './osm-pbf-reader';
import { encodeTestPbf, tags } from './test-helper';

describe('readOsmPbf', () => {
  it('decodes dense nodes, ways and relations with their tags and deltas undone', () => {
    const nodes: OsmNode[] = [
      { id: 10, lon: 55.27, lat: 25.19, tags: tags({}) },
      { id: 12, lon: 55.28, lat: 25.2, tags: tags({ highway: 'crossing' }) },
      { id: 15, lon: 55.29, lat: 25.21, tags: tags({}) },
    ];
    const ways: OsmWay[] = [
      { id: 100, refs: [10, 12, 15], tags: tags({ highway: 'residential', name: 'Al Wasl' }) },
    ];
    const relations: OsmRelation[] = [
      {
        id: 7,
        members: [
          { type: 'way', ref: 100, role: 'from' },
          { type: 'node', ref: 12, role: 'via' },
          { type: 'way', ref: 100, role: 'to' },
        ],
        tags: tags({ type: 'restriction', restriction: 'no_u_turn' }),
      },
    ];
    const path = join(mkdtempSync(join(tmpdir(), 'osm-pbf-')), 'tiny.osm.pbf');
    writeFileSync(path, encodeTestPbf(nodes, ways, relations));

    const seenNodes: OsmNode[] = [];
    const seenWays: OsmWay[] = [];
    const seenRelations: OsmRelation[] = [];
    readOsmPbf(path, {
      node: node => seenNodes.push(node),
      way: way => seenWays.push(way),
      relation: relation => seenRelations.push(relation),
    });

    expect(seenNodes.map(node => node.id)).toEqual([10, 12, 15]);
    expect(seenNodes[1].lon).toBeCloseTo(55.28, 6);
    expect(seenNodes[1].lat).toBeCloseTo(25.2, 6);
    expect(seenNodes[1].tags.get('highway')).toBe('crossing');
    expect(seenNodes[0].tags.size).toBe(0);
    expect(seenWays).toHaveLength(1);
    expect(seenWays[0].refs).toEqual([10, 12, 15]);
    expect(seenWays[0].tags.get('name')).toBe('Al Wasl');
    expect(seenRelations[0].members).toEqual(relations[0].members);
    expect(seenRelations[0].tags.get('restriction')).toBe('no_u_turn');
  });
});
