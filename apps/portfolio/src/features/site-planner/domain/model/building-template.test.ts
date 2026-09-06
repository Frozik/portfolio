import { describe, expect, it } from 'vitest';
import { computeMultiPolygonBounds } from '../geometry/bounding-box';
import { evaluateComposition } from '../geometry/evaluate-composition';
import { polylineLength, wallCenterline } from '../geometry/wall-geometry';
import { STOCK_HOUSE_TEMPLATES } from '../templates/stock-houses';
import { storeysOf, wallsOf } from './building';
import { instantiateBuildingTemplate, templateFacts } from './building-template';
import { parseStockBuilding } from './snapshot';

const AT = { x: 40, y: 30 };

function allIdsOf(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      allIdsOf(item, into);
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, field] of Object.entries(value)) {
      if (key === 'id' && typeof field === 'string') {
        into.add(field);
      } else {
        allIdsOf(field, into);
      }
    }
  }
}

describe('instantiateBuildingTemplate', () => {
  const [dacha] = STOCK_HOUSE_TEMPLATES;

  it('mints every id anew, so one template can stand on the plot twice', () => {
    const first = instantiateBuildingTemplate(dacha, AT);
    const second = instantiateBuildingTemplate(dacha, AT);
    const firstIds = new Set<string>();
    const secondIds = new Set<string>();

    allIdsOf(first, firstIds);
    allIdsOf(second, secondIds);

    for (const id of firstIds) {
      expect(secondIds.has(id)).toBe(false);
    }
  });

  it('keeps every reference aimed at the reminted object, not the authored one', () => {
    const placed = instantiateBuildingTemplate(dacha, AT);
    const storey = storeysOf(placed)[0];
    const wallIds = new Set(storey.walls.map(wall => wall.id));

    for (const opening of storey.openings) {
      expect(wallIds.has(opening.wallId)).toBe(true);
    }

    for (const device of storey.devices ?? []) {
      if (device.host.kind === 'wall') {
        expect(wallIds.has(device.host.wallId)).toBe(true);
      }
    }
  });

  it('centres the footprint on the asked-for point', () => {
    const placed = instantiateBuildingTemplate(dacha, AT);
    const bounds = computeMultiPolygonBounds(evaluateComposition(placed.composition));

    expect((bounds?.minX ?? 0) + (bounds?.maxX ?? 0)).toBeCloseTo(2 * AT.x);
    expect((bounds?.minY ?? 0) + (bounds?.maxY ?? 0)).toBeCloseTo(2 * AT.y);

    const wallPoints = wallsOf(placed).flatMap(wall => wall.points);

    expect(wallPoints.every(point => Math.abs(point.x - AT.x) < 10)).toBe(true);
  });
});

describe('the stock-house catalogue', () => {
  it.each(STOCK_HOUSE_TEMPLATES.map(template => [template.building.name, template] as const))(
    '%s hangs every opening on a wall it fits: no offset past the wall end',
    (_name, template) => {
      for (const storey of storeysOf(template.building)) {
        const wallLengths = new Map(
          storey.walls.map(wall => [wall.id, polylineLength(wallCenterline(wall))])
        );

        for (const openingInstance of storey.openings) {
          const length = wallLengths.get(openingInstance.wallId);

          expect(length).toBeDefined();
          expect(
            openingInstance.offsetMeters + openingInstance.widthMeters / 2
          ).toBeLessThanOrEqual(length ?? 0);
          expect(
            openingInstance.offsetMeters - openingInstance.widthMeters / 2
          ).toBeGreaterThanOrEqual(0);
        }
      }
    }
  );

  it.each(STOCK_HOUSE_TEMPLATES.map(template => [template.building.name, template] as const))(
    '%s survives the file round trip the «Из файла» path reads',
    (_name, template) => {
      const parsed = parseStockBuilding(JSON.stringify(template.building));

      expect(parsed).toBeDefined();
      expect(parsed?.name).toBe(template.building.name);
    }
  );
});

describe('the two-storey cottage template', () => {
  it('carries two storeys, a connecting stair and the upper slab', () => {
    const cottage = STOCK_HOUSE_TEMPLATES.find(template => template.id === 'cottage-8x9');

    expect(cottage).toBeDefined();

    const storeys = storeysOf(cottage?.building ?? STOCK_HOUSE_TEMPLATES[0].building);

    expect(storeys).toHaveLength(2);
    expect(storeys[0].stairs ?? []).toHaveLength(1);
    expect(storeys[1].slabs ?? []).toHaveLength(1);

    const facts = templateFacts(cottage?.building ?? STOCK_HOUSE_TEMPLATES[0].building);

    expect(facts.storeyCount).toBe(2);
    expect(facts.areaSquareMeters).toBeCloseTo(72);
    expect(facts.systems).toContain('gas');
  });
});

describe('the terrace house (traced from the RuPlans sheet)', () => {
  it('carries the plan: 4 bedrooms in two wings, the recessed terrace and the porch', () => {
    const template = STOCK_HOUSE_TEMPLATES.find(
      candidate => candidate.id === 'terrace-house-16x13'
    );

    expect(template).toBeDefined();

    const building = template?.building ?? STOCK_HOUSE_TEMPLATES[0].building;
    const [storey] = storeysOf(building);
    const labels = storey.roomLabels.map(label => label.roomTypeId);

    expect(labels.filter(label => label === 'bedroom')).toHaveLength(4);
    // Each wing's own bathroom plus the с/у of the entry block.
    expect(labels.filter(label => label === 'bathroom')).toHaveLength(3);
    // The терраса between the wings and the крыльцо outside the south wall.
    expect(labels.filter(label => label === 'veranda')).toHaveLength(2);

    for (const required of ['living', 'kitchen', 'laundry', 'boiler', 'wardrobe']) {
      expect(labels).toContain(required);
    }

    // The render's stone chimney: a fireplace on the terrace wall and its flue.
    expect((storey.fireplaces ?? []).some(fireplace => fireplace.kind === 'fireplace')).toBe(true);
    expect((storey.ducts ?? []).some(duct => duct.kind === 'flue')).toBe(true);
    expect(storey.supports ?? []).toHaveLength(4);
  });
});

describe('the estate houses', () => {
  it.each([
    ['residence-19x12', 1],
    ['manor-12x11', 2],
  ])(
    '%s carries the estate brief: master suite, 2 offices, sauna cluster, pantry and veranda',
    (id, storeyCount) => {
      const template = STOCK_HOUSE_TEMPLATES.find(candidate => candidate.id === id);

      expect(template).toBeDefined();

      const building = template?.building ?? STOCK_HOUSE_TEMPLATES[0].building;
      const storeys = storeysOf(building);
      const labels = storeys.flatMap(storey => storey.roomLabels.map(label => label.roomTypeId));

      expect(labels.filter(label => label === 'bedroom')).toHaveLength(3);
      expect(labels.filter(label => label === 'office')).toHaveLength(2);
      // The master bath, the sauna's wash room and at least one spare.
      expect(labels.filter(label => label === 'bathroom').length).toBeGreaterThanOrEqual(3);

      for (const required of [
        'living',
        'kitchen',
        'pantry',
        'sauna',
        'laundry',
        'boiler',
        'hall',
        'wardrobe',
        'veranda',
      ]) {
        expect(labels).toContain(required);
      }

      // The sauna cluster rests too: a sofa stands on the same storey as the stove.
      const saunaStorey = storeys.find(storey =>
        (storey.fireplaces ?? []).some(fireplace => fireplace.kind === 'saunaStove')
      );

      expect(saunaStorey).toBeDefined();
      expect((saunaStorey?.furniture ?? []).some(piece => piece.catalogId === 'sofa')).toBe(true);

      // The veranda: posts carry its cover, and a table waits outside the walls.
      expect(storeys[0].supports ?? []).toHaveLength(2);
      expect(templateFacts(building).storeyCount).toBe(storeyCount);
    }
  );
});

describe('the full-program family houses', () => {
  it.each([
    ['grange-15x10', 1],
    ['family-cottage-10x9', 2],
  ])(
    '%s carries the whole brief: 3 bedrooms, master suite, dining, sauna, laundry, boiler, hall',
    (id, storeyCount) => {
      const template = STOCK_HOUSE_TEMPLATES.find(candidate => candidate.id === id);

      expect(template).toBeDefined();

      const building = template?.building ?? STOCK_HOUSE_TEMPLATES[0].building;
      const labels = storeysOf(building).flatMap(storey =>
        storey.roomLabels.map(label => label.roomTypeId)
      );

      expect(labels.filter(label => label === 'bedroom')).toHaveLength(3);

      for (const required of [
        'living',
        'dining',
        'sauna',
        'laundry',
        'boiler',
        'hall',
        'wardrobe',
      ]) {
        expect(labels).toContain(required);
      }

      // The master suite: the wardrobe and one bathroom stand NEXT to a bedroom,
      // and a desk marks its work corner.
      expect(labels.filter(label => label === 'bathroom').length).toBeGreaterThanOrEqual(2);
      expect(
        storeysOf(building).some(storey =>
          (storey.furniture ?? []).some(piece => piece.catalogId === 'desk')
        )
      ).toBe(true);
      expect(templateFacts(building).storeyCount).toBe(storeyCount);
    }
  );
});
