import type { Vector2 } from '@frozik/utils/math/vector2';
import { isEqual, isNil, uniqWith } from 'lodash-es';

import type { WiringRoute, WiringRouteId } from '../model/wiring-routes';
import { dropRepeatedPoints } from './dedupe-polyline';
import { pointAlongPolyline, projectOntoPolyline } from './wall-geometry';

/** How far a device may stand from a drawn route and still be served by it. */
const ROUTE_REACH_METERS = 1;
/** Points this close are one junction — two routes meet, the cable continues. */
const JUNCTION_EPSILON_METERS = 0.05;

/** One stretch of a drawn route a run travels — what the fill count reads. */
export interface RouteStretch {
  readonly routeId: WiringRouteId;
  readonly segmentIndex: number;
}

/** A run laid along the drawn routes: its plan points and the stretches it rode. */
export interface RoutedRun {
  readonly points: readonly Vector2[];
  readonly stretches: readonly RouteStretch[];
}

interface Node {
  readonly point: Vector2;
  readonly edges: Edge[];
}

interface Edge {
  readonly to: Node;
  readonly length: number;
  readonly stretch: RouteStretch;
}

/** One drawn stretch with every node standing on it, in order along it. */
interface Chain {
  readonly stretch: RouteStretch;
  readonly start: Vector2;
  readonly end: Vector2;
  readonly nodes: { readonly node: Node; readonly along: number }[];
}

/**
 * The run from one point to another along the drawn routes (`wiring.md`
 * §3.3): each end is dropped onto the nearest route within reach, and the
 * shortest path over the routes — joined wherever a vertex of one stands on
 * another — is the run. Nothing when either end is out of reach or the routes
 * do not connect: the caller then keeps the derived path along the walls.
 */
export function routeAlongDrawnRoutes(
  routes: readonly WiringRoute[],
  from: Vector2,
  to: Vector2
): RoutedRun | undefined {
  if (routes.length === 0) {
    return undefined;
  }

  const chains = buildChains(routes);
  const start = attach(chains, from);
  const end = attach(chains, to);

  if (isNil(start) || isNil(end)) {
    return undefined;
  }

  const path = shortestPath(start, end);

  if (isNil(path)) {
    return undefined;
  }

  // A landing on a vertex adds a zero-length hop; the run is what is left
  // once those collapse and each stretch is counted once.
  return {
    points: dropRepeatedPoints([from, ...path.points, to]),
    stretches: uniqWith(path.stretches, isEqual),
  };
}

function distanceBetween(first: Vector2, second: Vector2): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function link(first: Node, second: Node, stretch: RouteStretch): void {
  const length = distanceBetween(first.point, second.point);

  first.edges.push({ to: second, length, stretch });
  second.edges.push({ to: first, length, stretch });
}

/**
 * Every vertex of every route becomes a node — vertices within a whisker of
 * each other one node — and every stretch is chained through the nodes that
 * stand on it, so a route ending on another's side turns off it there.
 */
function buildChains(routes: readonly WiringRoute[]): readonly Chain[] {
  const nodes: Node[] = [];
  const nodeAt = (point: Vector2): Node => {
    const existing = nodes.find(
      candidate => distanceBetween(candidate.point, point) <= JUNCTION_EPSILON_METERS
    );

    if (!isNil(existing)) {
      return existing;
    }

    const node: Node = { point, edges: [] };

    nodes.push(node);

    return node;
  };

  for (const route of routes) {
    route.points.forEach(point => nodeAt(point));
  }

  const chains: Chain[] = [];

  for (const route of routes) {
    for (let index = 1; index < route.points.length; index += 1) {
      const start = route.points[index - 1];
      const end = route.points[index];
      const stretch: RouteStretch = { routeId: route.id, segmentIndex: index - 1 };
      const onStretch = nodes
        .map(node => ({ node, projection: projectOntoPolyline([start, end], node.point) }))
        .filter(({ projection }) => projection.distanceMeters <= JUNCTION_EPSILON_METERS)
        .map(({ node, projection }) => ({ node, along: projection.offsetMeters }))
        .sort((left, right) => left.along - right.along);

      for (let position = 1; position < onStretch.length; position += 1) {
        link(onStretch[position - 1].node, onStretch[position].node, stretch);
      }

      chains.push({ stretch, start, end, nodes: onStretch });
    }
  }

  return chains;
}

/**
 * Drops a free point onto the nearest stretch within reach as a node of its
 * own, wired to the neighbours it lands between.
 */
function attach(chains: readonly Chain[], point: Vector2): Node | undefined {
  let best:
    | {
        readonly chain: Chain;
        readonly at: Vector2;
        readonly along: number;
        readonly distance: number;
      }
    | undefined;

  for (const chain of chains) {
    const projection = projectOntoPolyline([chain.start, chain.end], point);

    if (
      projection.distanceMeters <= ROUTE_REACH_METERS &&
      (isNil(best) || projection.distanceMeters < best.distance)
    ) {
      best = {
        chain,
        at: pointAlongPolyline([chain.start, chain.end], projection.offsetMeters),
        along: projection.offsetMeters,
        distance: projection.distanceMeters,
      };
    }
  }

  if (isNil(best)) {
    return undefined;
  }

  const node: Node = { point: best.at, edges: [] };
  const before = best.chain.nodes.filter(entry => entry.along <= best.along).at(-1);
  const after = best.chain.nodes.find(entry => entry.along > best.along);

  for (const neighbour of [before, after]) {
    if (!isNil(neighbour)) {
      link(node, neighbour.node, best.chain.stretch);
    }
  }

  // The landing joins the chain, so the next landing on the same stretch is
  // wired to it directly rather than round by a vertex.
  best.chain.nodes.push({ node, along: best.along });
  best.chain.nodes.sort((left, right) => left.along - right.along);

  return node;
}

/** Dijkstra over a graph small enough that a scan beats a heap. */
function shortestPath(
  start: Node,
  end: Node
):
  | { readonly points: readonly Vector2[]; readonly stretches: readonly RouteStretch[] }
  | undefined {
  const distance = new Map<Node, number>([[start, 0]]);
  const cameFrom = new Map<Node, { readonly node: Node; readonly edge: Edge }>();
  const open = new Set<Node>([start]);
  const closed = new Set<Node>();
  const distanceTo = (node: Node): number => distance.get(node) ?? Number.POSITIVE_INFINITY;

  while (open.size > 0) {
    let current: Node | undefined;

    for (const candidate of open) {
      if (isNil(current) || distanceTo(candidate) < distanceTo(current)) {
        current = candidate;
      }
    }

    if (isNil(current)) {
      break;
    }

    open.delete(current);
    closed.add(current);

    if (current === end) {
      break;
    }

    for (const edge of current.edges) {
      if (closed.has(edge.to)) {
        continue;
      }

      const next = distanceTo(current) + edge.length;

      if (next < distanceTo(edge.to)) {
        distance.set(edge.to, next);
        cameFrom.set(edge.to, { node: current, edge });
        open.add(edge.to);
      }
    }
  }

  if (!distance.has(end)) {
    return undefined;
  }

  const points: Vector2[] = [];
  const stretches: RouteStretch[] = [];
  let node: Node | undefined = end;

  while (!isNil(node)) {
    points.unshift(node.point);

    const step: { readonly node: Node; readonly edge: Edge } | undefined = cameFrom.get(node);

    if (!isNil(step)) {
      stretches.unshift(step.edge.stretch);
    }

    node = step?.node;
  }

  return { points, stretches };
}
