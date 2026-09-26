import type { RoadLine } from './road-lines';

interface LineVertex {
  readonly lineKey: string;
  readonly vertexIndex: number;
}

/** A way a car can leave a junction: onto this line, from this vertex, in this direction. */
export interface Exit {
  readonly lineKey: string;
  readonly vertexIndex: number;
  readonly direction: 1 | -1;
}

/**
 * The roads of every street tile in the picture as one network: a vertex
 * shared by two lines — a crossing, a T-junction, or the same road
 * continuing in the next tile — is a junction, where a car may change
 * line. Rebuilt whenever the set of tiles changes; cheap enough for that.
 */
export interface StreetGraph {
  readonly lines: ReadonlyMap<string, RoadLine>;
  /** For each line, the indices of its vertices that are junctions, ascending. */
  readonly junctionsOf: ReadonlyMap<string, readonly number[]>;
  readonly linesAt: ReadonlyMap<string, readonly LineVertex[]>;
}

export function buildStreetGraph(tiles: Iterable<readonly RoadLine[]>): StreetGraph {
  const lines = new Map<string, RoadLine>();
  const linesAt = new Map<string, LineVertex[]>();
  for (const tileLines of tiles) {
    for (const line of tileLines) {
      lines.set(line.key, line);
      line.vertexKeys.forEach((key, vertexIndex) => {
        const at = linesAt.get(key);
        const vertex = { lineKey: line.key, vertexIndex };
        if (at === undefined) {
          linesAt.set(key, [vertex]);
        } else {
          at.push(vertex);
        }
      });
    }
  }
  const junctionsOf = new Map<string, number[]>();
  for (const line of lines.values()) {
    const junctions = line.vertexKeys.flatMap((key, vertexIndex) =>
      (linesAt.get(key)?.length ?? 0) > 1 ? [vertexIndex] : []
    );
    junctionsOf.set(line.key, junctions);
  }
  return { lines, junctionsOf, linesAt };
}

/** Every direction a car may drive off in from this vertex of this line, across all lines through it. */
export function exitsFrom(
  graph: StreetGraph,
  lineKey: string,
  vertexIndex: number
): readonly Exit[] {
  const line = graph.lines.get(lineKey);
  if (line === undefined) {
    return [];
  }
  const exits: Exit[] = [];
  for (const vertex of graph.linesAt.get(line.vertexKeys[vertexIndex]) ?? []) {
    const other = graph.lines.get(vertex.lineKey);
    if (other === undefined) {
      continue;
    }
    if (vertex.vertexIndex < other.points.length - 1 && other.oneway !== -1) {
      exits.push({ lineKey: other.key, vertexIndex: vertex.vertexIndex, direction: 1 });
    }
    if (vertex.vertexIndex > 0 && other.oneway !== 1) {
      exits.push({ lineKey: other.key, vertexIndex: vertex.vertexIndex, direction: -1 });
    }
  }
  return exits;
}

/**
 * Where cars come in from beyond the loaded tiles: a line end on the tile
 * border with no neighbour continuing it, entered in a direction the road
 * allows. Cars that drive off the edge come back through these.
 */
export function entriesInto(graph: StreetGraph): readonly Exit[] {
  const entries: Exit[] = [];
  for (const line of graph.lines.values()) {
    const last = line.points.length - 1;
    const lonely = (vertexIndex: number): boolean =>
      (graph.linesAt.get(line.vertexKeys[vertexIndex])?.length ?? 0) === 1;
    if (line.bordersAtStart && line.oneway !== -1 && lonely(0)) {
      entries.push({ lineKey: line.key, vertexIndex: 0, direction: 1 });
    }
    if (line.bordersAtEnd && line.oneway !== 1 && lonely(last)) {
      entries.push({ lineKey: line.key, vertexIndex: last, direction: -1 });
    }
  }
  return entries;
}
