import { deflateSync } from 'node:zlib';

import { PbfWriter } from 'pbf';

import type { OsmNode, OsmRelation, OsmWay } from './osm-pbf-reader';

const GRANULARITY = 100;
const NANODEGREES_PER_DEGREE = 1e9;

class StringTable {
  readonly strings: string[] = [''];
  private readonly index = new Map<string, number>([['', 0]]);

  intern(value: string): number {
    const existing = this.index.get(value);
    if (existing !== undefined) {
      return existing;
    }
    this.strings.push(value);
    this.index.set(value, this.strings.length - 1);
    return this.strings.length - 1;
  }
}

function tagPairs(
  tags: ReadonlyMap<string, string>,
  table: StringTable
): { keys: number[]; vals: number[] } {
  const keys: number[] = [];
  const vals: number[] = [];
  for (const [key, value] of tags) {
    keys.push(table.intern(key));
    vals.push(table.intern(value));
  }
  return { keys, vals };
}

/** Encodes one OSMData blob (zlib) holding the given entities — enough to exercise the reader. */
export function encodeTestPbf(
  nodes: readonly OsmNode[],
  ways: readonly OsmWay[],
  relations: readonly OsmRelation[] = []
): Uint8Array {
  const table = new StringTable();
  const group = new PbfWriter();

  if (nodes.length > 0) {
    const dense = new PbfWriter();
    let lastId = 0;
    let lastLat = 0;
    let lastLon = 0;
    const ids: number[] = [];
    const lats: number[] = [];
    const lons: number[] = [];
    const keysVals: number[] = [];
    for (const node of nodes) {
      ids.push(node.id - lastId);
      const lat = Math.round((node.lat * NANODEGREES_PER_DEGREE) / GRANULARITY);
      const lon = Math.round((node.lon * NANODEGREES_PER_DEGREE) / GRANULARITY);
      lats.push(lat - lastLat);
      lons.push(lon - lastLon);
      lastId = node.id;
      lastLat = lat;
      lastLon = lon;
      const { keys, vals } = tagPairs(node.tags, table);
      keys.forEach((key, index) => keysVals.push(key, vals[index]));
      keysVals.push(0);
    }
    dense.writePackedSVarint(1, ids);
    dense.writePackedSVarint(8, lats);
    dense.writePackedSVarint(9, lons);
    dense.writePackedVarint(10, keysVals);
    group.writeBytesField(2, dense.finish());
  }

  for (const way of ways) {
    const message = new PbfWriter();
    message.writeVarintField(1, way.id);
    const { keys, vals } = tagPairs(way.tags, table);
    message.writePackedVarint(2, keys);
    message.writePackedVarint(3, vals);
    let last = 0;
    message.writePackedSVarint(
      8,
      way.refs.map(ref => {
        const delta = ref - last;
        last = ref;
        return delta;
      })
    );
    group.writeBytesField(3, message.finish());
  }

  for (const relation of relations) {
    const message = new PbfWriter();
    message.writeVarintField(1, relation.id);
    const { keys, vals } = tagPairs(relation.tags, table);
    message.writePackedVarint(2, keys);
    message.writePackedVarint(3, vals);
    message.writePackedVarint(
      8,
      relation.members.map(member => table.intern(member.role))
    );
    let last = 0;
    message.writePackedSVarint(
      9,
      relation.members.map(member => {
        const delta = member.ref - last;
        last = member.ref;
        return delta;
      })
    );
    message.writePackedVarint(
      10,
      relation.members.map(member => ['node', 'way', 'relation'].indexOf(member.type))
    );
    group.writeBytesField(4, message.finish());
  }

  const block = new PbfWriter();
  const stringTable = new PbfWriter();
  for (const value of table.strings) {
    stringTable.writeBytesField(1, new TextEncoder().encode(value));
  }
  block.writeBytesField(1, stringTable.finish());
  block.writeBytesField(2, group.finish());
  block.writeVarintField(17, GRANULARITY);

  const blob = new PbfWriter();
  const compressed = new Uint8Array(deflateSync(block.finish()));
  blob.writeVarintField(2, compressed.length);
  blob.writeBytesField(3, compressed);
  const blobBytes = blob.finish();

  const header = new PbfWriter();
  header.writeStringField(1, 'OSMData');
  header.writeVarintField(3, blobBytes.length);
  const headerBytes = header.finish();

  const file = new Uint8Array(4 + headerBytes.length + blobBytes.length);
  new DataView(file.buffer).setUint32(0, headerBytes.length, false);
  file.set(headerBytes, 4);
  file.set(blobBytes, 4 + headerBytes.length);
  return file;
}

export function tags(entries: Record<string, string>): ReadonlyMap<string, string> {
  return new Map(Object.entries(entries));
}
