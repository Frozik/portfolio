import { openSync, readSync, closeSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

import { PbfReader } from 'pbf';

/**
 * A streaming reader for the OSM PBF container (fileformat.proto +
 * osmformat.proto), decoded by hand with `pbf` so no stale parser package
 * is needed. Only what routing consumes is materialised: node coordinates,
 * ways with tags and node refs, relations with members and tags.
 */

const MAX_BLOB_HEADER_BYTES = 64 * 1024;
const NANODEGREES_PER_DEGREE = 1e9;
const DEFAULT_GRANULARITY = 100;

export interface OsmNode {
  readonly id: number;
  readonly lon: number;
  readonly lat: number;
  readonly tags: ReadonlyMap<string, string>;
}

export interface OsmWay {
  readonly id: number;
  readonly refs: readonly number[];
  readonly tags: ReadonlyMap<string, string>;
}

interface OsmRelationMember {
  readonly type: 'node' | 'way' | 'relation';
  readonly ref: number;
  readonly role: string;
}

export interface OsmRelation {
  readonly id: number;
  readonly members: readonly OsmRelationMember[];
  readonly tags: ReadonlyMap<string, string>;
}

export interface OsmVisitor {
  readonly node?: (node: OsmNode) => void;
  readonly way?: (way: OsmWay) => void;
  readonly relation?: (relation: OsmRelation) => void;
}

interface BlobHeader {
  type: string;
  datasize: number;
}

interface Blob {
  raw?: Uint8Array;
  zlib?: Uint8Array;
}

interface PrimitiveBlock {
  strings: string[];
  granularity: number;
  latOffset: number;
  lonOffset: number;
  groups: Uint8Array[];
}

function readBlobHeader(tag: number, header: BlobHeader, pbf: PbfReader): void {
  if (tag === 1) {
    header.type = pbf.readString();
  } else if (tag === 3) {
    header.datasize = pbf.readVarint();
  }
}

function readBlob(tag: number, blob: Blob, pbf: PbfReader): void {
  if (tag === 1) {
    blob.raw = pbf.readBytes();
  } else if (tag === 3) {
    blob.zlib = pbf.readBytes();
  }
}

const textDecoder = new TextDecoder();

function readStringTable(tag: number, strings: string[], pbf: PbfReader): void {
  if (tag === 1) {
    strings.push(textDecoder.decode(pbf.readBytes()));
  }
}

function readPrimitiveBlock(tag: number, block: PrimitiveBlock, pbf: PbfReader): void {
  switch (tag) {
    case 1:
      pbf.readMessage(readStringTable, block.strings);
      break;
    case 2:
      block.groups.push(pbf.readBytes());
      break;
    case 17:
      block.granularity = pbf.readVarint();
      break;
    case 19:
      block.latOffset = pbf.readVarint();
      break;
    case 20:
      block.lonOffset = pbf.readVarint();
      break;
    default:
      break;
  }
}

function tagsFromKeyValues(
  keys: readonly number[],
  values: readonly number[],
  strings: readonly string[]
): Map<string, string> {
  const tags = new Map<string, string>();
  for (let index = 0; index < keys.length; index++) {
    tags.set(strings[keys[index]], strings[values[index]]);
  }
  return tags;
}

interface DenseNodes {
  ids: number[];
  lats: number[];
  lons: number[];
  keysVals: number[];
}

function readDenseNodes(tag: number, dense: DenseNodes, pbf: PbfReader): void {
  switch (tag) {
    case 1:
      pbf.readPackedSVarint(dense.ids);
      break;
    case 8:
      pbf.readPackedSVarint(dense.lats);
      break;
    case 9:
      pbf.readPackedSVarint(dense.lons);
      break;
    case 10:
      pbf.readPackedVarint(dense.keysVals);
      break;
    default:
      break;
  }
}

interface WayMessage {
  id: number;
  keys: number[];
  vals: number[];
  refs: number[];
}

function readWay(tag: number, way: WayMessage, pbf: PbfReader): void {
  switch (tag) {
    case 1:
      way.id = pbf.readVarint();
      break;
    case 2:
      pbf.readPackedVarint(way.keys);
      break;
    case 3:
      pbf.readPackedVarint(way.vals);
      break;
    case 8:
      pbf.readPackedSVarint(way.refs);
      break;
    default:
      break;
  }
}

interface RelationMessage {
  id: number;
  keys: number[];
  vals: number[];
  roles: number[];
  memids: number[];
  types: number[];
}

function readRelation(tag: number, relation: RelationMessage, pbf: PbfReader): void {
  switch (tag) {
    case 1:
      relation.id = pbf.readVarint();
      break;
    case 2:
      pbf.readPackedVarint(relation.keys);
      break;
    case 3:
      pbf.readPackedVarint(relation.vals);
      break;
    case 8:
      pbf.readPackedVarint(relation.roles);
      break;
    case 9:
      pbf.readPackedSVarint(relation.memids);
      break;
    case 10:
      pbf.readPackedVarint(relation.types);
      break;
    default:
      break;
  }
}

const MEMBER_TYPES = ['node', 'way', 'relation'] as const;

interface PrimitiveGroup {
  dense?: DenseNodes;
  ways: WayMessage[];
  relations: RelationMessage[];
}

function readPrimitiveGroup(tag: number, group: PrimitiveGroup, pbf: PbfReader): void {
  switch (tag) {
    case 2: {
      const dense: DenseNodes = { ids: [], lats: [], lons: [], keysVals: [] };
      pbf.readMessage(readDenseNodes, dense);
      group.dense = dense;
      break;
    }
    case 3: {
      const way: WayMessage = { id: 0, keys: [], vals: [], refs: [] };
      pbf.readMessage(readWay, way);
      group.ways.push(way);
      break;
    }
    case 4: {
      const relation: RelationMessage = {
        id: 0,
        keys: [],
        vals: [],
        roles: [],
        memids: [],
        types: [],
      };
      pbf.readMessage(readRelation, relation);
      group.relations.push(relation);
      break;
    }
    default:
      break;
  }
}

function emitDenseNodes(
  dense: DenseNodes,
  block: PrimitiveBlock,
  visit: (node: OsmNode) => void
): void {
  let id = 0;
  let lat = 0;
  let lon = 0;
  let keyValueCursor = 0;
  for (let index = 0; index < dense.ids.length; index++) {
    id += dense.ids[index];
    lat += dense.lats[index];
    lon += dense.lons[index];
    const tags = new Map<string, string>();
    if (dense.keysVals.length > 0) {
      while (keyValueCursor < dense.keysVals.length && dense.keysVals[keyValueCursor] !== 0) {
        tags.set(
          block.strings[dense.keysVals[keyValueCursor]],
          block.strings[dense.keysVals[keyValueCursor + 1]]
        );
        keyValueCursor += 2;
      }
      keyValueCursor++;
    }
    visit({
      id,
      lat: (block.latOffset + lat * block.granularity) / NANODEGREES_PER_DEGREE,
      lon: (block.lonOffset + lon * block.granularity) / NANODEGREES_PER_DEGREE,
      tags,
    });
  }
}

function emitBlock(block: PrimitiveBlock, visitor: OsmVisitor): void {
  for (const groupBytes of block.groups) {
    const group: PrimitiveGroup = { ways: [], relations: [] };
    new PbfReader(groupBytes).readFields(readPrimitiveGroup, group);
    if (group.dense !== undefined && visitor.node !== undefined) {
      emitDenseNodes(group.dense, block, visitor.node);
    }
    if (visitor.way !== undefined) {
      for (const way of group.ways) {
        let ref = 0;
        const refs = way.refs.map(delta => (ref += delta));
        visitor.way({
          id: way.id,
          refs,
          tags: tagsFromKeyValues(way.keys, way.vals, block.strings),
        });
      }
    }
    if (visitor.relation !== undefined) {
      for (const relation of group.relations) {
        let ref = 0;
        const members = relation.memids.map((delta, index) => {
          ref += delta;
          return {
            type: MEMBER_TYPES[relation.types[index]],
            ref,
            role: block.strings[relation.roles[index]],
          };
        });
        visitor.relation({
          id: relation.id,
          members,
          tags: tagsFromKeyValues(relation.keys, relation.vals, block.strings),
        });
      }
    }
  }
}

function readExact(fd: number, length: number, position: number): Uint8Array | undefined {
  const buffer = new Uint8Array(length);
  const read = readSync(fd, buffer, 0, length, position);
  if (read === 0) {
    return undefined;
  }
  if (read !== length) {
    throw new Error(`short read at ${position}: ${read} of ${length} bytes`);
  }
  return buffer;
}

/** Walks the whole file once, calling the visitor for every entity kind it asks for. */
export function readOsmPbf(path: string, visitor: OsmVisitor): void {
  const fd = openSync(path, 'r');
  try {
    let position = 0;
    for (;;) {
      const lengthBytes = readExact(fd, 4, position);
      if (lengthBytes === undefined) {
        return;
      }
      position += 4;
      const headerLength = new DataView(lengthBytes.buffer).getUint32(0, false);
      if (headerLength > MAX_BLOB_HEADER_BYTES) {
        throw new Error(`blob header of ${headerLength} bytes at ${position}`);
      }
      const headerBytes = readExact(fd, headerLength, position);
      if (headerBytes === undefined) {
        throw new Error('truncated blob header');
      }
      position += headerLength;
      const header: BlobHeader = { type: '', datasize: 0 };
      new PbfReader(headerBytes).readFields(readBlobHeader, header);

      const blobBytes = readExact(fd, header.datasize, position);
      if (blobBytes === undefined) {
        throw new Error('truncated blob');
      }
      position += header.datasize;
      if (header.type !== 'OSMData') {
        continue;
      }
      const blob: Blob = {};
      new PbfReader(blobBytes).readFields(readBlob, blob);
      const data = blob.zlib !== undefined ? new Uint8Array(inflateSync(blob.zlib)) : blob.raw;
      if (data === undefined) {
        throw new Error('blob without raw or zlib payload');
      }
      const block: PrimitiveBlock = {
        strings: [],
        granularity: DEFAULT_GRANULARITY,
        latOffset: 0,
        lonOffset: 0,
        groups: [],
      };
      new PbfReader(data).readFields(readPrimitiveBlock, block);
      emitBlock(block, visitor);
    }
  } finally {
    closeSync(fd);
  }
}
