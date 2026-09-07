import { ByteReader, ByteWriter } from './byte-io';
import { PACK_FORMAT_VERSION, PACK_MAGIC } from './format';
import type { RoutingGraph } from './graph';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function writeDeltaCoordinates(writer: ByteWriter, values: Int32Array): void {
  let previous = 0;
  for (const value of values) {
    writer.writeSignedVarint(value - previous);
    previous = value;
  }
}

function readDeltaCoordinates(reader: ByteReader, count: number): Int32Array {
  const values = new Int32Array(count);
  let previous = 0;
  for (let index = 0; index < count; index++) {
    previous += reader.readSignedVarint();
    values[index] = previous;
  }
  return values;
}

function writeVarints(writer: ByteWriter, values: Uint32Array): void {
  for (const value of values) {
    writer.writeVarint(value);
  }
}

function readVarints(reader: ByteReader, count: number): Uint32Array {
  const values = new Uint32Array(count);
  for (let index = 0; index < count; index++) {
    values[index] = reader.readVarint();
  }
  return values;
}

/** Serialises a graph into the pack layout (`PACK_FORMAT_VERSION`). */
export function encodePack(graph: RoutingGraph): Uint8Array {
  const writer = new ByteWriter();
  writer.writeUint32(PACK_MAGIC);
  writer.writeUint32(PACK_FORMAT_VERSION);
  writer.writeUint32(graph.nodeCount);
  writer.writeUint32(graph.edgeCount);
  writer.writeUint32(graph.geometryLon.length);
  writer.writeUint32(graph.names.length);
  writer.writeUint32(graph.restrictionFromEdge.length);

  writeDeltaCoordinates(writer, graph.nodeLon);
  writeDeltaCoordinates(writer, graph.nodeLat);

  writeVarints(writer, graph.edgeFrom);
  writeVarints(writer, graph.edgeTo);
  writeVarints(writer, graph.edgeLengthCm);
  writer.writeBytes(graph.edgeAccess);
  writer.writeBytes(graph.edgeRoadClass);
  writer.writeBytes(graph.edgeFlags);
  writeVarints(writer, graph.edgeNameIndex);
  for (let edge = 0; edge < graph.edgeCount; edge++) {
    writer.writeVarint(graph.edgeGeometryStart[edge + 1] - graph.edgeGeometryStart[edge]);
  }

  writeDeltaCoordinates(writer, graph.geometryLon);
  writeDeltaCoordinates(writer, graph.geometryLat);

  for (const name of graph.names) {
    const bytes = textEncoder.encode(name);
    writer.writeVarint(bytes.length);
    writer.writeBytes(bytes);
  }

  writeVarints(writer, graph.restrictionFromEdge);
  writeVarints(writer, graph.restrictionViaNode);
  writeVarints(writer, graph.restrictionToEdge);
  writer.writeBytes(graph.restrictionKind);
  return writer.toBytes();
}

export class PackFormatError extends Error {}

/** Parses a pack; throws `PackFormatError` for foreign or newer files. */
export function decodePack(bytes: Uint8Array): RoutingGraph {
  const reader = new ByteReader(bytes);
  if (reader.readUint32() !== PACK_MAGIC) {
    throw new PackFormatError('not a navigation pack');
  }
  const version = reader.readUint32();
  if (version > PACK_FORMAT_VERSION) {
    throw new PackFormatError(
      `pack format ${version} is newer than the supported ${PACK_FORMAT_VERSION}`
    );
  }
  const nodeCount = reader.readUint32();
  const edgeCount = reader.readUint32();
  const geometryCount = reader.readUint32();
  const nameCount = reader.readUint32();
  const restrictionCount = reader.readUint32();

  const nodeLon = readDeltaCoordinates(reader, nodeCount);
  const nodeLat = readDeltaCoordinates(reader, nodeCount);

  const edgeFrom = readVarints(reader, edgeCount);
  const edgeTo = readVarints(reader, edgeCount);
  const edgeLengthCm = readVarints(reader, edgeCount);
  const edgeAccess = reader.readBytes(edgeCount).slice();
  const edgeRoadClass = reader.readBytes(edgeCount).slice();
  const edgeFlags = reader.readBytes(edgeCount).slice();
  const edgeNameIndex = readVarints(reader, edgeCount);
  const edgeGeometryStart = new Uint32Array(edgeCount + 1);
  for (let edge = 0; edge < edgeCount; edge++) {
    edgeGeometryStart[edge + 1] = edgeGeometryStart[edge] + reader.readVarint();
  }
  if (edgeGeometryStart[edgeCount] !== geometryCount) {
    throw new PackFormatError('geometry offsets do not match the geometry length');
  }

  const geometryLon = readDeltaCoordinates(reader, geometryCount);
  const geometryLat = readDeltaCoordinates(reader, geometryCount);

  const names: string[] = [];
  for (let index = 0; index < nameCount; index++) {
    names.push(textDecoder.decode(reader.readBytes(reader.readVarint())));
  }

  const restrictionFromEdge = readVarints(reader, restrictionCount);
  const restrictionViaNode = readVarints(reader, restrictionCount);
  const restrictionToEdge = readVarints(reader, restrictionCount);
  const restrictionKind = reader.readBytes(restrictionCount).slice();
  if (reader.remaining !== 0) {
    throw new PackFormatError(`${reader.remaining} trailing bytes`);
  }

  return {
    nodeCount,
    nodeLon,
    nodeLat,
    edgeCount,
    edgeFrom,
    edgeTo,
    edgeLengthCm,
    edgeAccess,
    edgeRoadClass,
    edgeFlags,
    edgeNameIndex,
    edgeGeometryStart,
    geometryLon,
    geometryLat,
    names,
    restrictionFromEdge,
    restrictionViaNode,
    restrictionToEdge,
    restrictionKind,
  };
}
