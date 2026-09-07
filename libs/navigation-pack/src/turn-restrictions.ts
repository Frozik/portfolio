import { RESTRICTION_KIND } from './format';
import type { RoutingGraph } from './graph';

export interface RestrictionsAtEdge {
  readonly viaNode: number[];
  readonly toEdge: number[];
  readonly kind: number[];
}

/** Turn restrictions grouped by the edge they start from. */
export function indexRestrictions(graph: RoutingGraph): Map<number, RestrictionsAtEdge> {
  const byFrom = new Map<number, RestrictionsAtEdge>();
  for (let index = 0; index < graph.restrictionFromEdge.length; index++) {
    const from = graph.restrictionFromEdge[index];
    let entry = byFrom.get(from);
    if (entry === undefined) {
      entry = { viaNode: [], toEdge: [], kind: [] };
      byFrom.set(from, entry);
    }
    entry.viaNode.push(graph.restrictionViaNode[index]);
    entry.toEdge.push(graph.restrictionToEdge[index]);
    entry.kind.push(graph.restrictionKind[index]);
  }
  return byFrom;
}

export function turnAllowed(
  restrictions: Map<number, RestrictionsAtEdge>,
  fromEdge: number,
  viaNode: number,
  toEdge: number
): boolean {
  const entry = restrictions.get(fromEdge);
  if (entry === undefined) {
    return true;
  }
  let hasOnly = false;
  let onlyMatches = false;
  for (let index = 0; index < entry.viaNode.length; index++) {
    if (entry.viaNode[index] !== viaNode) {
      continue;
    }
    if (entry.kind[index] === RESTRICTION_KIND.no) {
      if (entry.toEdge[index] === toEdge) {
        return false;
      }
    } else {
      hasOnly = true;
      onlyMatches ||= entry.toEdge[index] === toEdge;
    }
  }
  return !hasOnly || onlyMatches;
}
