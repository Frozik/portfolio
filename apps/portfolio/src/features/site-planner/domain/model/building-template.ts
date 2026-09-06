import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { computeMultiPolygonBounds } from '../geometry/bounding-box';
import { multiPolygonArea } from '../geometry/building-outline';
import { evaluateComposition } from '../geometry/evaluate-composition';
import { entriesOf, storeysOf } from './building';
import type { Building } from './building';
import { translateBuilding } from './building-edits';
import type { UtilitySystem } from './foundation';

/**
 * One stock house the catalogue offers: a complete {@link Building} — walls,
 * storeys, furniture, electrics, utility entries, roof — authored against the
 * same domain model the editor writes, so placing one is indistinguishable
 * from having drawn it by hand. The row label is the building's own name —
 * the same one the placed house keeps.
 */
export interface BuildingTemplate {
  readonly id: string;
  readonly building: Building;
}

/**
 * The template stamped onto the plot: every id minted anew and the whole
 * building carried so its footprint CENTRES on `at`. Fresh ids are what let
 * one template be placed twice — and what keeps a template module reusable at
 * all, since its literal carries the ids it was authored with.
 *
 * The reminting walks the parsed tree generically: first every `id` field is
 * collected, then EVERY string equal to a collected id is replaced — wherever
 * it hides (`wallId`, `switchId`, arrays of device ids). A field-by-field copy
 * here would be the storey-object switch all over again: one more reference
 * field added to the model, one more silently stale id.
 */
/** What the catalogue card states under the preview: the house in numbers. */
export interface BuildingTemplateFacts {
  readonly storeyCount: number;
  readonly roomCount: number;
  readonly areaSquareMeters: number;
  readonly systems: readonly UtilitySystem[];
}

export function templateFacts(building: Building): BuildingTemplateFacts {
  const storeys = storeysOf(building);

  return {
    storeyCount: storeys.length,
    roomCount: storeys.reduce((sum, storey) => sum + storey.roomLabels.length, 0),
    areaSquareMeters: multiPolygonArea(evaluateComposition(building.composition)),
    systems: entriesOf(building).map(entry => entry.system),
  };
}

export function instantiateBuildingTemplate(template: BuildingTemplate, at: Vector2): Building {
  const minted = new Map<string, string>();

  collectIds(template.building, minted);

  const reminted = remapIds(template.building, minted) as Building;
  const bounds = computeMultiPolygonBounds(evaluateComposition(reminted.composition));
  const center: Vector2 = isNil(bounds)
    ? { x: 0, y: 0 }
    : { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };

  return translateBuilding(reminted, { x: at.x - center.x, y: at.y - center.y });
}

function collectIds(value: unknown, minted: Map<string, string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectIds(item, minted);
    }

    return;
  }

  if (typeof value !== 'object' || isNil(value)) {
    return;
  }

  for (const [key, field] of Object.entries(value)) {
    if (key === 'id' && typeof field === 'string' && !minted.has(field)) {
      minted.set(field, crypto.randomUUID());
    } else {
      collectIds(field, minted);
    }
  }
}

function remapIds(value: unknown, minted: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') {
    return minted.get(value) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map(item => remapIds(item, minted));
  }

  if (typeof value !== 'object' || isNil(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, remapIds(field, minted)])
  );
}
