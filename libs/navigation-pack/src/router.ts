import { isNil } from 'lodash-es';

import type { Profile, RoadClass } from './format';
import { haversineMetres, toDegrees } from './geo';
import type { Adjacency, RoutingGraph } from './graph';
import { buildAdjacency } from './graph';
import { MinHeap } from './min-heap';
import { backwardBit, forwardBit, PROFILE_MAX_SPEED_KMH, travelSeconds } from './profiles';
import { appendWholeEdge, cutEdgeGeometry, polylineMetres } from './route-geometry';
import type { SnappedPoint } from './snap';
import type { RestrictionsAtEdge } from './turn-restrictions';
import { indexRestrictions, turnAllowed } from './turn-restrictions';

const KMH_TO_MPS = 1 / 3.6;

export interface RouteEdge {
  readonly edge: number;
  /** `true` when travelled from the edge's `from` node to its `to` node. */
  readonly forward: boolean;
}

export interface RouteResult {
  readonly distanceMetres: number;
  readonly durationSeconds: number;
  /** Degrees, from the snapped origin to the snapped destination. */
  readonly geometryLon: Float64Array;
  readonly geometryLat: Float64Array;
  /** Whole edges between the two partial ones, in travel order. */
  readonly edges: readonly RouteEdge[];
  /** Search effort, for the pack-size / speed measurements. */
  readonly settledStates: number;
}

/**
 * Edge-based A* over the pack graph: a search state is "arrived at the end
 * of edge E travelling in direction D", so turn restrictions apply exactly
 * and a node may be entered from several edges with different futures.
 */
export class Router {
  private readonly adjacency: Adjacency;
  private readonly restrictions: Map<number, RestrictionsAtEdge>;

  constructor(private readonly graph: RoutingGraph) {
    this.adjacency = buildAdjacency(graph);
    this.restrictions = indexRestrictions(graph);
  }

  route(
    profile: Profile,
    origin: SnappedPoint,
    destination: SnappedPoint
  ): RouteResult | undefined {
    const direct = this.directAlongEdge(profile, origin, destination);
    const searched = this.search(profile, origin, destination);
    if (isNil(direct)) {
      return searched;
    }
    if (isNil(searched) || direct.durationSeconds <= searched.durationSeconds) {
      return direct;
    }
    return searched;
  }

  private edgeSeconds(profile: Profile, edge: number, fraction = 1): number {
    return travelSeconds(
      profile,
      this.graph.edgeRoadClass[edge] as RoadClass,
      (this.graph.edgeLengthCm[edge] / 100) * fraction
    );
  }

  private canTraverse(profile: Profile, edge: number, forward: boolean): boolean {
    const bit = forward ? forwardBit(profile) : backwardBit(profile);
    return (this.graph.edgeAccess[edge] & bit) !== 0;
  }

  private directAlongEdge(
    profile: Profile,
    origin: SnappedPoint,
    destination: SnappedPoint
  ): RouteResult | undefined {
    if (origin.edge !== destination.edge) {
      return undefined;
    }
    const forward = origin.fraction <= destination.fraction;
    if (!this.canTraverse(profile, origin.edge, forward)) {
      return undefined;
    }
    const lon: number[] = [];
    const lat: number[] = [];
    cutEdgeGeometry(this.graph, origin.edge, origin.fraction, destination.fraction, lon, lat);
    return {
      distanceMetres: polylineMetres(lon, lat),
      durationSeconds: this.edgeSeconds(
        profile,
        origin.edge,
        Math.abs(destination.fraction - origin.fraction)
      ),
      geometryLon: Float64Array.from(lon),
      geometryLat: Float64Array.from(lat),
      edges: [],
      settledStates: 0,
    };
  }

  private search(
    profile: Profile,
    origin: SnappedPoint,
    destination: SnappedPoint
  ): RouteResult | undefined {
    const { graph, adjacency } = this;
    const stateCount = graph.edgeCount * 2;
    const cost = new Float64Array(stateCount).fill(Number.POSITIVE_INFINITY);
    const parent = new Int32Array(stateCount).fill(-1);
    const closed = new Uint8Array(stateCount);
    const heap = new MinHeap();
    const maxSpeed = PROFILE_MAX_SPEED_KMH[profile] * KMH_TO_MPS;
    const goalLon = destination.lon;
    const goalLat = destination.lat;
    const heuristic = (node: number): number =>
      haversineMetres(
        toDegrees(graph.nodeLon[node]),
        toDegrees(graph.nodeLat[node]),
        goalLon,
        goalLat
      ) / maxSpeed;
    const endNode = (edge: number, forward: boolean): number =>
      forward ? graph.edgeTo[edge] : graph.edgeFrom[edge];

    const push = (edge: number, forward: boolean, arrival: number, from: number): void => {
      const state = edge * 2 + (forward ? 0 : 1);
      if (arrival >= cost[state]) {
        return;
      }
      cost[state] = arrival;
      parent[state] = from;
      heap.push(arrival + heuristic(endNode(edge, forward)), state);
    };

    if (this.canTraverse(profile, origin.edge, true)) {
      push(origin.edge, true, this.edgeSeconds(profile, origin.edge, 1 - origin.fraction), -1);
    }
    if (this.canTraverse(profile, origin.edge, false)) {
      push(origin.edge, false, this.edgeSeconds(profile, origin.edge, origin.fraction), -1);
    }

    let bestTotal = Number.POSITIVE_INFINITY;
    let bestState = -1;
    let bestGoalForward = true;
    let settled = 0;

    while (heap.length > 0) {
      if (heap.peekKey() >= bestTotal) {
        break;
      }
      const state = heap.pop();
      if (closed[state] === 1) {
        continue;
      }
      closed[state] = 1;
      settled++;
      const edge = state >> 1;
      const forward = (state & 1) === 0;
      const node = endNode(edge, forward);
      const arrived = cost[state];

      const mayEnterGoal = edge !== destination.edge;
      if (
        mayEnterGoal &&
        node === graph.edgeFrom[destination.edge] &&
        this.canTraverse(profile, destination.edge, true) &&
        turnAllowed(this.restrictions, edge, node, destination.edge)
      ) {
        const total = arrived + this.edgeSeconds(profile, destination.edge, destination.fraction);
        if (total < bestTotal) {
          bestTotal = total;
          bestState = state;
          bestGoalForward = true;
        }
      }
      if (
        mayEnterGoal &&
        node === graph.edgeTo[destination.edge] &&
        this.canTraverse(profile, destination.edge, false) &&
        turnAllowed(this.restrictions, edge, node, destination.edge)
      ) {
        const total =
          arrived + this.edgeSeconds(profile, destination.edge, 1 - destination.fraction);
        if (total < bestTotal) {
          bestTotal = total;
          bestState = state;
          bestGoalForward = false;
        }
      }

      for (let slot = adjacency.start[node]; slot < adjacency.start[node + 1]; slot++) {
        const next = adjacency.edges[slot];
        if (next === edge || graph.edgeFrom[next] === graph.edgeTo[next]) {
          continue;
        }
        const nextForward = graph.edgeFrom[next] === node;
        if (!this.canTraverse(profile, next, nextForward)) {
          continue;
        }
        if (!turnAllowed(this.restrictions, edge, node, next)) {
          continue;
        }
        push(next, nextForward, arrived + this.edgeSeconds(profile, next), state);
      }
    }

    if (bestState < 0) {
      return undefined;
    }

    const chain: number[] = [];
    for (let state = bestState; state >= 0; state = parent[state]) {
      chain.push(state);
    }
    chain.reverse();

    const lon: number[] = [];
    const lat: number[] = [];
    const firstState = chain[0];
    const firstForward = (firstState & 1) === 0;
    cutEdgeGeometry(graph, origin.edge, origin.fraction, firstForward ? 1 : 0, lon, lat);
    const edges: RouteEdge[] = [];
    for (let index = 1; index < chain.length; index++) {
      const edge = chain[index] >> 1;
      const forward = (chain[index] & 1) === 0;
      edges.push({ edge, forward });
      appendWholeEdge(graph, edge, forward, lon, lat);
    }
    const goalLonBefore = lon.length;
    cutEdgeGeometry(
      graph,
      destination.edge,
      bestGoalForward ? 0 : 1,
      destination.fraction,
      lon,
      lat
    );
    // The cut starts at the node the previous segment already ended on.
    lon.splice(goalLonBefore, 1);
    lat.splice(goalLonBefore, 1);

    return {
      distanceMetres: polylineMetres(lon, lat),
      durationSeconds: bestTotal,
      geometryLon: Float64Array.from(lon),
      geometryLat: Float64Array.from(lat),
      edges,
      settledStates: settled,
    };
  }
}
