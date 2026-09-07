import type { RestrictionKind, RoadClass } from './format';
import { haversineMetres, toDegrees, toMicrodegrees } from './geo';
import type { RoutingGraph } from './graph';

export interface EdgeInput {
  readonly from: number;
  readonly to: number;
  readonly access: number;
  readonly roadClass: RoadClass;
  readonly flags: number;
  readonly name: string;
  /** Intermediate shape points between the endpoints, in degrees. */
  readonly shape: ReadonlyArray<readonly [lon: number, lat: number]>;
}

export interface RestrictionInput {
  readonly fromEdge: number;
  readonly viaNode: number;
  readonly toEdge: number;
  readonly kind: RestrictionKind;
}

/** Accumulates nodes and edges and produces the typed-array graph the pack stores. */
export class GraphBuilder {
  private readonly nodeLon: number[] = [];
  private readonly nodeLat: number[] = [];
  private readonly edges: EdgeInput[] = [];
  private readonly restrictions: RestrictionInput[] = [];
  private readonly nameIndex = new Map<string, number>([['', 0]]);
  private readonly names: string[] = [''];

  addNode(lon: number, lat: number): number {
    this.nodeLon.push(toMicrodegrees(lon));
    this.nodeLat.push(toMicrodegrees(lat));
    return this.nodeLon.length - 1;
  }

  get nodeCount(): number {
    return this.nodeLon.length;
  }

  addEdge(edge: EdgeInput): number {
    this.edges.push(edge);
    return this.edges.length - 1;
  }

  addRestriction(restriction: RestrictionInput): void {
    this.restrictions.push(restriction);
  }

  build(): RoutingGraph {
    const edgeCount = this.edges.length;
    const edgeFrom = new Uint32Array(edgeCount);
    const edgeTo = new Uint32Array(edgeCount);
    const edgeLengthCm = new Uint32Array(edgeCount);
    const edgeAccess = new Uint8Array(edgeCount);
    const edgeRoadClass = new Uint8Array(edgeCount);
    const edgeFlags = new Uint8Array(edgeCount);
    const edgeNameIndex = new Uint32Array(edgeCount);
    const edgeGeometryStart = new Uint32Array(edgeCount + 1);
    const geometryLon: number[] = [];
    const geometryLat: number[] = [];

    this.edges.forEach((edge, index) => {
      edgeFrom[index] = edge.from;
      edgeTo[index] = edge.to;
      edgeAccess[index] = edge.access;
      edgeRoadClass[index] = edge.roadClass;
      edgeFlags[index] = edge.flags;
      edgeNameIndex[index] = this.internName(edge.name);
      edgeGeometryStart[index] = geometryLon.length;

      const points: number[][] = [
        [this.nodeLon[edge.from], this.nodeLat[edge.from]],
        ...edge.shape.map(([lon, lat]) => [toMicrodegrees(lon), toMicrodegrees(lat)]),
        [this.nodeLon[edge.to], this.nodeLat[edge.to]],
      ];
      let lengthMetres = 0;
      for (let point = 0; point < points.length; point++) {
        geometryLon.push(points[point][0]);
        geometryLat.push(points[point][1]);
        if (point > 0) {
          lengthMetres += haversineMetres(
            toDegrees(points[point - 1][0]),
            toDegrees(points[point - 1][1]),
            toDegrees(points[point][0]),
            toDegrees(points[point][1])
          );
        }
      }
      edgeLengthCm[index] = Math.round(lengthMetres * 100);
    });
    edgeGeometryStart[edgeCount] = geometryLon.length;

    const restrictionCount = this.restrictions.length;
    const restrictionFromEdge = new Uint32Array(restrictionCount);
    const restrictionViaNode = new Uint32Array(restrictionCount);
    const restrictionToEdge = new Uint32Array(restrictionCount);
    const restrictionKind = new Uint8Array(restrictionCount);
    this.restrictions.forEach((restriction, index) => {
      restrictionFromEdge[index] = restriction.fromEdge;
      restrictionViaNode[index] = restriction.viaNode;
      restrictionToEdge[index] = restriction.toEdge;
      restrictionKind[index] = restriction.kind;
    });

    return {
      nodeCount: this.nodeLon.length,
      nodeLon: Int32Array.from(this.nodeLon),
      nodeLat: Int32Array.from(this.nodeLat),
      edgeCount,
      edgeFrom,
      edgeTo,
      edgeLengthCm,
      edgeAccess,
      edgeRoadClass,
      edgeFlags,
      edgeNameIndex,
      edgeGeometryStart,
      geometryLon: Int32Array.from(geometryLon),
      geometryLat: Int32Array.from(geometryLat),
      names: this.names,
      restrictionFromEdge,
      restrictionViaNode,
      restrictionToEdge,
      restrictionKind,
    };
  }

  private internName(name: string): number {
    const existing = this.nameIndex.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const index = this.names.length;
    this.names.push(name);
    this.nameIndex.set(name, index);
    return index;
  }
}
