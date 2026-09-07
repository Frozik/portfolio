import { RESTRICTION_KIND } from '@frozik/navigation-pack/format';
import type { RestrictionKind, RoadClass } from '@frozik/navigation-pack/format';
import type { RoutingGraph } from '@frozik/navigation-pack/graph';
import { GraphBuilder } from '@frozik/navigation-pack/graph-builder';
import { classifyHighway, computeWayAccess } from '@frozik/navigation-pack/profiles';
import { isNil } from 'lodash-es';

import type { OsmRelation, OsmWay } from '../pbf/osm-pbf-reader';
import { readOsmPbf } from '../pbf/osm-pbf-reader';

interface RoutableWay {
  readonly id: number;
  readonly refs: readonly number[];
  readonly access: number;
  readonly flags: number;
  readonly roadClass: RoadClass;
  readonly name: string;
}

interface TurnRestriction {
  readonly fromWay: number;
  readonly viaNode: number;
  readonly toWay: number;
  readonly kind: RestrictionKind;
}

export interface BuildStats {
  readonly waysRead: number;
  readonly routableWays: number;
  readonly osmNodesUsed: number;
  readonly restrictionsRead: number;
  readonly restrictionsApplied: number;
}

function wayName(tags: ReadonlyMap<string, string>): string {
  return tags.get('name:en') ?? tags.get('name') ?? tags.get('ref') ?? '';
}

function toRoutableWay(way: OsmWay): RoutableWay | undefined {
  const roadClass = classifyHighway(way.tags.get('highway'));
  if (isNil(roadClass) || way.refs.length < 2) {
    return undefined;
  }
  if (way.tags.get('area') === 'yes') {
    return undefined;
  }
  const access = computeWayAccess(way.tags, roadClass);
  if (isNil(access)) {
    return undefined;
  }
  return {
    id: way.id,
    refs: way.refs,
    access: access.access,
    flags: access.flags,
    roadClass,
    name: wayName(way.tags),
  };
}

function toTurnRestriction(relation: OsmRelation): TurnRestriction | undefined {
  if (relation.tags.get('type') !== 'restriction') {
    return undefined;
  }
  const restriction = relation.tags.get('restriction') ?? relation.tags.get('restriction:motorcar');
  if (isNil(restriction)) {
    return undefined;
  }
  const kind: RestrictionKind | undefined = restriction.startsWith('no_')
    ? RESTRICTION_KIND.no
    : restriction.startsWith('only_')
      ? RESTRICTION_KIND.only
      : undefined;
  if (isNil(kind)) {
    return undefined;
  }
  const from = relation.members.find(member => member.role === 'from' && member.type === 'way');
  const via = relation.members.find(member => member.role === 'via' && member.type === 'node');
  const to = relation.members.find(member => member.role === 'to' && member.type === 'way');
  if (isNil(from) || isNil(via) || isNil(to)) {
    return undefined;
  }
  return { fromWay: from.ref, viaNode: via.ref, toWay: to.ref, kind };
}

/**
 * Two passes over the extract: ways first (which OSM nodes routing needs and
 * which of them are junctions), then node coordinates. Chains of
 * degree-two nodes collapse into one edge whose geometry keeps them.
 */
export function buildRoutingGraph(pbfPath: string): { graph: RoutingGraph; stats: BuildStats } {
  const ways: RoutableWay[] = [];
  const restrictions: TurnRestriction[] = [];
  const useCount = new Map<number, number>();
  let waysRead = 0;

  readOsmPbf(pbfPath, {
    way: way => {
      waysRead++;
      const routable = toRoutableWay(way);
      if (isNil(routable)) {
        return;
      }
      ways.push(routable);
      routable.refs.forEach((ref, index) => {
        const endpoint = index === 0 || index === routable.refs.length - 1 ? 2 : 1;
        useCount.set(ref, (useCount.get(ref) ?? 0) + endpoint);
      });
    },
    relation: relation => {
      const restriction = toTurnRestriction(relation);
      if (!isNil(restriction)) {
        restrictions.push(restriction);
      }
    },
  });
  for (const restriction of restrictions) {
    useCount.set(restriction.viaNode, (useCount.get(restriction.viaNode) ?? 0) + 2);
  }

  const coordinates = new Map<number, readonly [number, number]>();
  readOsmPbf(pbfPath, {
    node: node => {
      if (useCount.has(node.id)) {
        coordinates.set(node.id, [node.lon, node.lat]);
      }
    },
  });

  const builder = new GraphBuilder();
  const routingNodeOf = new Map<number, number>();
  const routingNode = (osmId: number): number | undefined => {
    const existing = routingNodeOf.get(osmId);
    if (!isNil(existing)) {
      return existing;
    }
    const coordinate = coordinates.get(osmId);
    if (isNil(coordinate)) {
      return undefined;
    }
    const index = builder.addNode(coordinate[0], coordinate[1]);
    routingNodeOf.set(osmId, index);
    return index;
  };
  const isJunction = (osmId: number): boolean => (useCount.get(osmId) ?? 0) >= 2;

  // way id → edges cut from it, in ref order, for restriction resolution.
  const edgesOfWay = new Map<number, { edge: number; fromOsm: number; toOsm: number }[]>();

  for (const way of ways) {
    const refs = way.refs.filter(ref => coordinates.has(ref));
    if (refs.length < 2) {
      continue;
    }
    let segmentStart = 0;
    for (let index = 1; index < refs.length; index++) {
      const isLast = index === refs.length - 1;
      if (!isLast && !isJunction(refs[index])) {
        continue;
      }
      const from = routingNode(refs[segmentStart]);
      const to = routingNode(refs[index]);
      if (isNil(from) || isNil(to)) {
        segmentStart = index;
        continue;
      }
      const shape: (readonly [number, number])[] = [];
      for (let inner = segmentStart + 1; inner < index; inner++) {
        const coordinate = coordinates.get(refs[inner]);
        if (!isNil(coordinate)) {
          shape.push(coordinate);
        }
      }
      const edge = builder.addEdge({
        from,
        to,
        access: way.access,
        flags: way.flags,
        roadClass: way.roadClass,
        name: way.name,
        shape,
      });
      let list = edgesOfWay.get(way.id);
      if (isNil(list)) {
        list = [];
        edgesOfWay.set(way.id, list);
      }
      list.push({ edge, fromOsm: refs[segmentStart], toOsm: refs[index] });
      segmentStart = index;
    }
  }

  let restrictionsApplied = 0;
  for (const restriction of restrictions) {
    const viaRouting = routingNodeOf.get(restriction.viaNode);
    const fromEdge = edgesOfWay
      .get(restriction.fromWay)
      ?.find(cut => cut.fromOsm === restriction.viaNode || cut.toOsm === restriction.viaNode);
    const toEdge = edgesOfWay
      .get(restriction.toWay)
      ?.find(cut => cut.fromOsm === restriction.viaNode || cut.toOsm === restriction.viaNode);
    if (isNil(viaRouting) || isNil(fromEdge) || isNil(toEdge)) {
      continue;
    }
    builder.addRestriction({
      fromEdge: fromEdge.edge,
      viaNode: viaRouting,
      toEdge: toEdge.edge,
      kind: restriction.kind,
    });
    restrictionsApplied++;
  }

  return {
    graph: builder.build(),
    stats: {
      waysRead,
      routableWays: ways.length,
      osmNodesUsed: coordinates.size,
      restrictionsRead: restrictions.length,
      restrictionsApplied,
    },
  };
}
