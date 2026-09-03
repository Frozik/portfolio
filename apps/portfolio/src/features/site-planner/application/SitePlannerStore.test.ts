import { assert } from '@frozik/utils/assert/assert';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { multiPolygonArea } from '../domain/geometry/building-outline';
import { DEFAULT_FOUNDATION } from '../domain/model/foundation';
import type {
  CsgOperand,
  RectangleShape,
  Shape,
  ShapeGroup,
  ShapeId,
} from '../domain/model/shapes';
import { createCircle, createRectangle, isShapeGroup } from '../domain/model/shapes';
import type { SitePlan } from '../domain/model/site-plan';
import {
  createDefaultSitePlan,
  createPathId,
  entriesOf,
  foundationOf,
  storeysOf,
} from '../domain/model/site-plan';
import type { ISitePlanRepository } from '../domain/persistence/ISitePlanRepository';
import { SitePlannerStore } from './SitePlannerStore';

const AUTOSAVE_DELAY_MS = 500;
const HISTORY_GROUP_WINDOW_MS = 1000;

interface RecordingRepository extends ISitePlanRepository {
  readonly savedPlans: SitePlan[];
}

function createRepository(storedPlan?: SitePlan): RecordingRepository {
  const savedPlans: SitePlan[] = [];

  return {
    savedPlans,
    loadPlan: () => Promise.resolve(storedPlan),
    savePlan: (plan: SitePlan) => {
      savedPlans.push(plan);

      return Promise.resolve();
    },
  };
}

function createFailingRepository(): ISitePlanRepository {
  return {
    loadPlan: () => Promise.resolve(undefined),
    savePlan: () => Promise.reject(new Error('quota exceeded')),
  };
}

function planWithSecondTerm(): SitePlan {
  const defaultPlan = createDefaultSitePlan();

  return {
    ...defaultPlan,
    boundary: {
      terms: [
        ...defaultPlan.boundary.terms,
        {
          operand: createRectangle({
            center: { x: 2, y: 3 },
            width: 4,
            length: 5,
            rotationDegrees: 0,
          }),
          operation: 'union',
        },
      ],
    },
  };
}

/** Lets the constructor's load settle before the test starts editing. */
async function settleInitialization(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function leafShape(operand: CsgOperand): Shape {
  assert(!isShapeGroup(operand), 'expected a primitive shape operand');

  return operand;
}

function leafRectangle(operand: CsgOperand): RectangleShape {
  const shape = leafShape(operand);

  assert(shape.kind === 'rectangle', 'expected a rectangle operand');

  return shape;
}

describe('SitePlannerStore history', () => {
  let store: SitePlannerStore;

  const drawRectangle = (center: { x: number; y: number }): void => {
    store.addShapeTerm(
      'boundary',
      createRectangle({ center, width: 2, length: 2, rotationDegrees: 0 }),
      'union'
    );
  };

  beforeEach(() => {
    store = new SitePlannerStore(createRepository());
  });

  afterEach(() => {
    store.dispose();
  });

  it('starts with nothing to undo or redo', () => {
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
  });

  it('undoes an added shape and redoes it again', () => {
    drawRectangle({ x: 5, y: 5 });

    expect(store.boundary.terms).toHaveLength(2);
    expect(store.canUndo).toBe(true);

    store.undo();

    expect(store.boundary.terms).toHaveLength(1);
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(true);

    store.redo();

    expect(store.boundary.terms).toHaveLength(2);
    expect(store.canRedo).toBe(false);
  });

  it('undoes a removed shape', () => {
    const [term] = store.boundary.terms;

    store.removeTerm('boundary', term.operand.id);

    expect(store.boundary.terms).toHaveLength(0);

    store.undo();

    expect(store.boundary.terms).toEqual([term]);
  });

  it('undoes step by step in reverse order', () => {
    drawRectangle({ x: 1, y: 1 });
    drawRectangle({ x: 2, y: 2 });

    store.undo();

    expect(store.boundary.terms).toHaveLength(2);

    store.undo();

    expect(store.boundary.terms).toHaveLength(1);
  });

  it('drops the redone future once a new edit lands', () => {
    drawRectangle({ x: 1, y: 1 });
    store.undo();

    expect(store.canRedo).toBe(true);

    drawRectangle({ x: 2, y: 2 });

    expect(store.canRedo).toBe(false);
  });

  it('records nothing for an announced edit that never lands', () => {
    store.pushHistory();
    store.pushHistory();

    expect(store.canUndo).toBe(false);
  });

  it('keeps an announcement that no edit followed out of the next step', () => {
    store.pushHistory();
    drawRectangle({ x: 1, y: 1 });
    store.undo();

    expect(store.boundary.terms).toHaveLength(1);
    expect(store.canUndo).toBe(false);
  });

  it('keeps a burst of edits to one field as a single step', () => {
    const [term] = store.boundary.terms;
    const rectangle = leafRectangle(term.operand);

    store.setSelection({ kind: 'shape', owner: 'boundary', shapeId: rectangle.id });

    for (const width of [11, 12, 13]) {
      store.pushHistory(`${rectangle.id}:width`);
      store.updateSelectedShape({ ...rectangle, width });
    }

    store.undo();

    expect(store.boundary.terms[0].operand).toEqual(rectangle);
    expect(store.canUndo).toBe(false);
  });

  it('starts a new step once the grouping window has passed', () => {
    vi.useFakeTimers();

    try {
      const [term] = store.boundary.terms;
      const rectangle = leafRectangle(term.operand);

      store.setSelection({ kind: 'shape', owner: 'boundary', shapeId: rectangle.id });

      store.pushHistory(`${rectangle.id}:width`);
      store.updateSelectedShape({ ...rectangle, width: 11 });

      vi.advanceTimersByTime(HISTORY_GROUP_WINDOW_MS);

      store.pushHistory(`${rectangle.id}:width`);
      store.updateSelectedShape({ ...rectangle, width: 12 });

      store.undo();

      expect(store.selectedShape).toEqual({ ...rectangle, width: 11 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SitePlannerStore persistence', () => {
  it('opens the plan the repository holds', async () => {
    const storedPlan = planWithSecondTerm();
    const store = new SitePlannerStore(createRepository(storedPlan));

    await settleInitialization();

    expect(store.snapshot).toEqual(storedPlan);

    store.dispose();
  });

  it('opens the default plan when the record cannot be read', async () => {
    const store = new SitePlannerStore(createRepository(undefined));

    await settleInitialization();

    const [defaultTerm] = createDefaultSitePlan().boundary.terms;

    expect(store.boundary.terms).toHaveLength(1);
    // Shape ids are minted per plan, so the quick-start plot is recognised by
    // its dimensions rather than by identity.
    expect(store.boundary.terms[0].operand).toMatchObject({
      kind: defaultTerm.operand.kind,
      center: leafShape(defaultTerm.operand).center,
    });
    expect(store.canUndo).toBe(false);

    store.dispose();
  });

  it('does not write the plan it has just read back to storage', async () => {
    vi.useFakeTimers();

    try {
      const repository = createRepository(planWithSecondTerm());
      const store = new SitePlannerStore(repository);

      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);

      expect(repository.savedPlans).toHaveLength(0);

      store.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves once after a burst of edits settles', async () => {
    vi.useFakeTimers();

    try {
      const repository = createRepository();
      const store = new SitePlannerStore(repository);

      await settleInitialization();

      store.addShapeTerm(
        'boundary',
        createRectangle({ center: { x: 1, y: 1 }, width: 2, length: 2, rotationDegrees: 0 }),
        'union'
      );
      store.addShapeTerm(
        'boundary',
        createRectangle({ center: { x: 3, y: 3 }, width: 2, length: 2, rotationDegrees: 0 }),
        'union'
      );

      expect(repository.savedPlans).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

      expect(repository.savedPlans).toHaveLength(1);
      expect(repository.savedPlans[0].boundary.terms).toHaveLength(3);
      expect(store.saveState).toBe('saved');

      store.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a failed save', async () => {
    vi.useFakeTimers();

    try {
      const store = new SitePlannerStore(createFailingRepository());

      await settleInitialization();

      store.addShapeTerm(
        'boundary',
        createRectangle({ center: { x: 1, y: 1 }, width: 2, length: 2, rotationDegrees: 0 }),
        'union'
      );

      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

      expect(store.saveState).toBe('error');

      store.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts no autosave when the route is left while the read is in flight', async () => {
    vi.useFakeTimers();

    try {
      const repository = createRepository();
      const store = new SitePlannerStore(repository);

      store.dispose();

      await settleInitialization();

      store.addShapeTerm(
        'boundary',
        createRectangle({ center: { x: 1, y: 1 }, width: 2, length: 2, rotationDegrees: 0 }),
        'union'
      );

      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);

      expect(repository.savedPlans).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops saving once disposed', async () => {
    vi.useFakeTimers();

    try {
      const repository = createRepository();
      const store = new SitePlannerStore(repository);

      await settleInitialization();
      store.dispose();

      store.addShapeTerm(
        'boundary',
        createRectangle({ center: { x: 1, y: 1 }, width: 2, length: 2, rotationDegrees: 0 }),
        'union'
      );

      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);

      expect(repository.savedPlans).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SitePlannerStore groups', () => {
  let store: SitePlannerStore;

  const plotId = (): ShapeId => store.boundary.terms[0].operand.id;
  const rootGroup = (): ShapeGroup | undefined => {
    const { operand } = store.boundary.terms[0];

    return isShapeGroup(operand) ? operand : undefined;
  };

  beforeEach(() => {
    store = new SitePlannerStore(createRepository());
  });

  afterEach(() => {
    store.dispose();
  });

  it('wraps a term and hands the new group over as selected and active', () => {
    const wrappedId = plotId();

    store.wrapTermInGroup('boundary', wrappedId);

    const group = rootGroup();

    expect(group?.terms).toHaveLength(1);
    expect(group?.terms[0].operand.id).toBe(wrappedId);
    expect(store.selection).toEqual({ kind: 'group', owner: 'boundary', groupId: group?.id });
    expect(store.resolvedActiveGroup).toEqual({ owner: 'boundary', groupId: group?.id });
  });

  it('adds a shape to the group it is told to, and reads it back as a plan shape', () => {
    store.wrapTermInGroup('boundary', plotId());

    const groupId = store.boundary.terms[0].operand.id;
    const pond = createCircle({ center: { x: 5, y: 5 }, radius: 2 });

    store.addShapeTerm('boundary', pond, 'subtract', groupId);

    expect(rootGroup()?.terms).toHaveLength(2);
    expect(rootGroup()?.terms[1]).toEqual({ operand: pond, operation: 'subtract' });
    expect(store.allShapes).toHaveLength(2);
    expect(store.selectedShape).toBeUndefined();

    store.setSelection({ kind: 'shape', owner: 'boundary', shapeId: pond.id });

    expect(store.selectedShape).toBe(pond);
  });

  it('switches the operation of a group as it does that of a shape', () => {
    store.wrapTermInGroup('boundary', plotId());

    const groupId = store.boundary.terms[0].operand.id;

    store.toggleTermOperation('boundary', groupId);

    expect(store.selectedGroupTerm?.operation).toBe('subtract');
    expect(store.boundaryPolygons).toEqual([]);
  });

  it('undoes a wrap and a subsequent ungroup', () => {
    const before = store.snapshot;

    store.wrapTermInGroup('boundary', plotId());

    const groupId = store.boundary.terms[0].operand.id;

    store.ungroupTerm('boundary', groupId);

    expect(store.boundary.terms[0].operand.kind).toBe('rectangle');

    store.undo();

    expect(store.boundary.terms[0].operand.id).toBe(groupId);

    store.undo();

    expect(store.snapshot).toEqual(before);
  });

  it('deletes a selected group with everything nested under it', () => {
    store.wrapTermInGroup('boundary', plotId());

    const groupId = store.boundary.terms[0].operand.id;

    store.addShapeTerm(
      'boundary',
      createCircle({ center: { x: 5, y: 5 }, radius: 2 }),
      'union',
      groupId
    );
    store.setSelection({ kind: 'group', owner: 'boundary', groupId });
    store.removeSelected();

    expect(store.boundary.terms).toHaveLength(0);
    expect(store.allShapes).toHaveLength(0);
    expect(store.selection).toBeUndefined();
    expect(store.resolvedActiveGroup).toEqual({ owner: 'boundary', groupId: undefined });
  });

  it('drags a term into a group and undoes the move as one step', () => {
    const wrappedId = plotId();

    store.wrapTermInGroup('boundary', wrappedId);

    const groupId = store.boundary.terms[0].operand.id;
    const pond = createCircle({ center: { x: 5, y: 5 }, radius: 2 });

    store.addShapeTerm('boundary', pond, 'subtract');
    store.moveTerm('boundary', pond.id, groupId, 1);

    expect(store.boundary.terms).toHaveLength(1);
    expect(rootGroup()?.terms.map(term => term.operand.id)).toEqual([wrappedId, pond.id]);

    store.undo();

    expect(store.boundary.terms.map(term => term.operand.id)).toEqual([groupId, pond.id]);
  });

  it('records no step for a drop that leaves the tree as it was', () => {
    store.moveTerm('boundary', plotId(), undefined, 0);

    expect(store.canUndo).toBe(false);
  });

  it('records no step for a group dropped into itself', () => {
    const before = store.snapshot;

    store.wrapTermInGroup('boundary', plotId());

    const groupId = store.boundary.terms[0].operand.id;

    store.moveTerm('boundary', groupId, groupId, 0);
    store.undo();

    expect(store.snapshot).toEqual(before);
  });

  it('falls back to the root once an undo takes the active group away', () => {
    store.wrapTermInGroup('boundary', plotId());

    const groupId = store.boundary.terms[0].operand.id;

    expect(store.resolvedActiveGroup.groupId).toBe(groupId);

    store.undo();

    expect(store.resolvedActiveGroup).toEqual({ owner: 'boundary', groupId: undefined });
  });
});

describe('SitePlannerStore gesture skeletons', () => {
  let store: SitePlannerStore;

  const houseShape = createRectangle({
    center: { x: 10, y: 10 },
    width: 6,
    length: 6,
    rotationDegrees: 0,
  });

  beforeEach(() => {
    store = new SitePlannerStore(createRepository());

    const building = store.addBuilding('Дом');

    store.addShapeTerm(building.id, houseShape, 'union');
  });

  afterEach(() => {
    store.dispose();
  });

  it('reads the shapes of both groups, the plot before the house', () => {
    const [plot] = store.boundary.terms.map(term => leafShape(term.operand));

    expect(store.allShapes).toEqual([plot, houseShape]);
  });

  it('outlines nothing while no gesture is running', () => {
    expect(store.gestureSkeletonShapes).toHaveLength(0);
  });

  it('outlines every shape but the one being shaped', () => {
    const [plot] = store.boundary.terms.map(term => leafShape(term.operand));

    store.setDraftShape(plot);

    expect(store.gestureSkeletonShapes).toEqual([houseShape]);

    store.setDraftShape(houseShape);

    expect(store.gestureSkeletonShapes).toEqual([plot]);
  });

  it('outlines all of them while a shape that is not on the plan yet is drawn', () => {
    store.setDraftShape(
      createRectangle({ center: { x: 0, y: 0 }, width: 1, length: 1, rotationDegrees: 0 })
    );

    expect(store.gestureSkeletonShapes).toHaveLength(2);
  });
});

describe('SitePlannerStore overlay mode across views', () => {
  it('drops the plan-only cut/fill overlay when the 3D view opens', () => {
    const store = new SitePlannerStore(createRepository());

    store.setOverlayMode('cut-fill');
    store.setViewMode('scene');

    expect(store.overlayMode).toBe('none');

    store.dispose();
  });

  it('keeps the slope overlay across the toggle', () => {
    const store = new SitePlannerStore(createRepository());

    store.setOverlayMode('slope');
    store.setViewMode('scene');

    expect(store.overlayMode).toBe('slope');

    store.setViewMode('plan');

    expect(store.overlayMode).toBe('slope');

    store.dispose();
  });
});

describe('SitePlannerStore armed shape tool', () => {
  it('follows the drawing tool the palette or a hotkey reaches for', () => {
    const store = new SitePlannerStore(createRepository());

    store.enterEditMode({ kind: 'site' });

    expect(store.armedShapeTool).toBe('rectangle');

    store.setActiveTool('circle');

    expect(store.armedShapeTool).toBe('circle');

    store.dispose();
  });

  it('opens site editing aimed at the house with the drawing tool in hand', () => {
    const store = new SitePlannerStore(createRepository());

    store.enterBuildingEditing('Дом');

    expect(store.editorMode).toEqual({ kind: 'edit', target: { kind: 'site' } });
    expect(store.activeGroup).toEqual({ owner: store.buildings[0].id, groupId: undefined });
    expect(store.isEditingBuilding).toBe(true);
    expect(store.buildings[0].name).toBe('Дом');
    expect(store.activeTool).toBe('rectangle');

    store.exitEditMode();

    expect(store.isEditingBuilding).toBe(false);

    store.dispose();
  });

  it('re-aims between the plot and the house without leaving the editor', () => {
    const store = new SitePlannerStore(createRepository());

    store.enterEditMode({ kind: 'site' });
    store.enterBuildingEditing('Дом');

    expect(store.editorMode).toEqual({ kind: 'edit', target: { kind: 'site' } });
    expect(store.isEditingBuilding).toBe(true);

    store.setActiveGroup('boundary');

    expect(store.editorMode).toEqual({ kind: 'edit', target: { kind: 'site' } });
    expect(store.isEditingBuilding).toBe(false);

    store.dispose();
  });

  it('keeps several named buildings apart, each with its own footprint and pad', () => {
    const store = new SitePlannerStore(createRepository());

    const house = store.addBuilding('Дом');

    store.addShapeTerm(
      house.id,
      createRectangle({ center: { x: 8, y: 8 }, width: 8, length: 10, rotationDegrees: 0 }),
      'union'
    );

    const shed = store.addBuilding('Кладовка');

    store.addShapeTerm(
      shed.id,
      createRectangle({ center: { x: 24, y: 30 }, width: 3, length: 4, rotationDegrees: 0 }),
      'union'
    );
    store.setWallHeight(shed.id, 2.2);
    store.renameBuilding(shed.id, 'Навес');

    expect(store.buildings.map(building => building.name)).toEqual(['Дом', 'Навес']);
    expect(store.buildings[0].composition.terms).toHaveLength(1);
    expect(store.buildings[1].composition.terms).toHaveLength(1);
    expect(store.buildings[0].wallHeight).toBe(3);
    expect(store.buildings[1].wallHeight).toBe(2.2);
    expect(store.buildingScenes[0].padElevation).not.toBeUndefined();
    expect(store.buildingScenes[1].padElevation).not.toBeUndefined();

    store.removeBuilding(shed.id);

    expect(store.buildings.map(building => building.name)).toEqual(['Дом']);
    expect(store.activeGroup.owner).toBe('boundary');

    store.dispose();
  });

  it('drops the hovered segment when the editor closes', () => {
    const store = new SitePlannerStore(createRepository());

    store.enterEditMode({ kind: 'path', pathId: createPathId() });
    store.setHoveredPathSegmentIndex(1);

    expect(store.hoveredPathSegmentIndex).toBe(1);

    store.exitEditMode();

    expect(store.hoveredPathSegmentIndex).toBeUndefined();

    store.dispose();
  });

  it('keeps the hovered segment out of a session that is not open', () => {
    const store = new SitePlannerStore(createRepository());

    // The hover lives in the path editor's session; without one it has nowhere
    // to land, and the plan must not light a segment no editor is showing.
    store.setHoveredPathSegmentIndex(1);

    expect(store.hoveredPathSegmentIndex).toBeUndefined();

    store.dispose();
  });

  it('keeps the armed shape while another tool is in hand', () => {
    const store = new SitePlannerStore(createRepository());

    store.enterEditMode({ kind: 'site' });
    store.setActiveTool('circle');
    store.setActiveTool('select');

    expect(store.armedShapeTool).toBe('circle');

    store.dispose();
  });
});

describe('SitePlannerStore foundations and utility entries', () => {
  const layOutBuilding = (store: SitePlannerStore) => {
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 10, length: 6, rotationDegrees: 0 }),
      'union'
    );

    return building;
  };

  it('starts every new building on the default slab', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutBuilding(store);

    expect(foundationOf(building)).toEqual(DEFAULT_FOUNDATION);
    expect(entriesOf(building)).toEqual([]);

    store.dispose();
  });

  it('edits the foundation as grouped steps and undoes back to the slab', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutBuilding(store);

    store.updateFoundation(building.id, { kind: 'stem-wall' });
    store.updateFoundation(building.id, { depthMeters: 1.2 });

    expect(foundationOf(store.buildings[0])).toMatchObject({
      kind: 'stem-wall',
      depthMeters: 1.2,
    });

    // Both edits share the building's foundation group — one step to undo.
    store.undo();

    expect(foundationOf(store.buildings[0])).toEqual(DEFAULT_FOUNDATION);

    store.dispose();
  });

  it('adds entries with their norm defaults, spaced along the outline', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutBuilding(store);

    store.addUtilityEntry(building.id, 'water');
    store.addUtilityEntry(building.id, 'gas');

    const [water, gas] = entriesOf(store.buildings[0]);

    expect(water).toMatchObject({ system: 'water', kind: 'sleeve', outlineOffsetMeters: 0 });
    expect(water.depthMeters).toBeCloseTo(2);
    expect(gas).toMatchObject({ system: 'gas', kind: 'facade', outlineOffsetMeters: 3 });

    store.dispose();
  });

  it('resolves entries onto the footprint outline for the plan', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutBuilding(store);

    store.addUtilityEntry(building.id, 'power');

    const [scene] = store.buildingScenes;

    expect(scene.entryPoints).toHaveLength(1);
    expect(scene.entryPoints[0].system).toBe('power');
    // The badge stands ON the outline of the 10 × 6 footprint around (10, 10).
    expect(scene.entryPoints[0].position.x).toBeGreaterThanOrEqual(5);
    expect(scene.entryPoints[0].position.x).toBeLessThanOrEqual(15);

    store.dispose();
  });

  it('updates and removes an entry', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutBuilding(store);

    store.addUtilityEntry(building.id, 'sewer');

    const [entry] = entriesOf(store.buildings[0]);

    store.updateUtilityEntry(building.id, entry.id, { outlineOffsetMeters: 7 });

    expect(entriesOf(store.buildings[0])[0].outlineOffsetMeters).toBe(7);

    store.removeUtilityEntry(building.id, entry.id);

    expect(entriesOf(store.buildings[0])).toEqual([]);

    store.dispose();
  });

  it('estimates the foundation concrete for the earthworks report', () => {
    const store = new SitePlannerStore(createRepository());

    layOutBuilding(store);

    const [scene] = store.buildingScenes;

    // A 60 m² slab, 0.6 m of total height (default 0.3 + 0.3).
    expect(scene.foundationVolumeCubicMeters).toBeCloseTo(36);

    store.dispose();
  });
});

describe('SitePlannerStore derived rooms', () => {
  const layOutPartitionedBuilding = (store: SitePlannerStore) => {
    store.enterEditMode({ kind: 'site' });

    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 10, length: 8, rotationDegrees: 0 }),
      'union'
    );
    store.exitEditMode();
    store.enterEditMode({ kind: 'building', buildingId: building.id });
    // A wall spanning the whole footprint, splitting it into two rooms.
    store.appendDraftWallPoint({ x: 5, y: 10 });
    store.appendDraftWallPoint({ x: 15, y: 10 });
    store.commitDraftWall();

    return building;
  };

  it('cuts the footprint into rooms and sums their area under the walls', () => {
    const store = new SitePlannerStore(createRepository());

    layOutPartitionedBuilding(store);

    const [scene] = store.buildingScenes;
    const rooms = scene.storeys[0].rooms;

    expect(rooms).toHaveLength(2);

    const totalArea = rooms.reduce((sum, room) => sum + room.areaSquareMeters, 0);

    // 10 × 8 footprint minus the 10 m brick wall (0.38 m thick).
    expect(totalArea).toBeCloseTo(80 - 10 * 0.38, 1);
  });

  it('pins a room type to its region and reads the wet flag back', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutPartitionedBuilding(store);
    const [scene] = store.buildingScenes;
    const [firstRoom] = scene.storeys[0].rooms;

    store.setRoomType(building.id, firstRoom, 'bathroom');

    const updated = store.buildingScenes[0].storeys[0].rooms.find(
      room => room.roomTypeId === 'bathroom'
    );

    expect(updated).toBeDefined();
    expect(updated?.isWet).toBe(true);

    // The other region stays unnamed.
    expect(
      store.buildingScenes[0].storeys[0].rooms.filter(room => room.roomTypeId === undefined)
    ).toHaveLength(1);

    store.dispose();
  });

  it('clears the type when the room is set back to unassigned', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutPartitionedBuilding(store);

    store.setRoomType(building.id, store.buildingScenes[0].storeys[0].rooms[0], 'kitchen');

    const assigned = store.buildingScenes[0].storeys[0].rooms.find(
      room => room.roomTypeId === 'kitchen'
    );

    expect(assigned).toBeDefined();

    if (assigned !== undefined) {
      store.setRoomType(building.id, assigned, undefined);
    }

    expect(
      store.buildingScenes[0].storeys[0].rooms.every(room => room.roomTypeId === undefined)
    ).toBe(true);

    store.dispose();
  });
});

describe('SitePlannerStore storeys', () => {
  const layOutHouse = (store: SitePlannerStore) => {
    store.enterEditMode({ kind: 'site' });

    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 10, length: 8, rotationDegrees: 0 }),
      'union'
    );
    store.exitEditMode();
    store.enterEditMode({ kind: 'building', buildingId: building.id });

    return building;
  };

  /** A closed ring of wall over part of the ground floor — the надстройка. */
  const drawUpperRing = (store: SitePlannerStore): void => {
    store.appendDraftWallPoint({ x: 7, y: 8 });
    store.appendDraftWallPoint({ x: 13, y: 8 });
    store.appendDraftWallPoint({ x: 13, y: 12 });
    store.appendDraftWallPoint({ x: 7, y: 12 });
    store.appendDraftWallPoint({ x: 7, y: 8 });
    store.commitDraftWall();
  };

  it('lays a slab on the storey and takes its outline from the slabs', () => {
    const store = new SitePlannerStore(createRepository());

    layOutHouse(store);
    store.addStoreyToEditedBuilding({ copyWalls: false });
    store.placeSlabAt({ x: 10, y: 10 });

    const [scene] = store.buildingScenes;
    const [, upper] = scene.storeys;

    expect(store.activeStoreySlabs).toHaveLength(1);
    expect(store.selection?.kind).toBe('slab');
    // 6 × 4 by default, and the outline is the slab rather than the walls.
    expect(multiPolygonArea(upper.footprint)).toBeCloseTo(24);

    store.dispose();
  });

  it('holds an upper storey wall on its own slab and lets it overhang the storey below', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutHouse(store);

    store.addStoreyToEditedBuilding({ copyWalls: false });
    // A slab hanging off the east side of the 10 × 8 ground floor: the
    // cantilever of R24, and the floor the balcony needs to be walked on.
    store.placeSlabAt({ x: 16, y: 10 });

    const held = store.clampWallPoint(building.id, { x: 40, y: 10 });

    expect(held.x).toBeCloseTo(19);
    // Past the ground floor's east edge at x = 15, which the old clamp forbade.
    expect(store.clampWallPoint(building.id, { x: 17, y: 10 })).toEqual({ x: 17, y: 10 });

    store.dispose();
  });

  it('leaves the ground storey held to the foundation and a slabless storey free', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutHouse(store);

    expect(store.clampWallPoint(building.id, { x: 40, y: 10 }).x).toBeCloseTo(15);

    store.addStoreyToEditedBuilding({ copyWalls: false });

    // Nothing to be held to yet, so the first wall of a bare storey can be
    // drawn anywhere — otherwise every corner would collapse onto one point.
    expect(store.clampWallPoint(building.id, { x: 40, y: 10 })).toEqual({ x: 40, y: 10 });

    store.dispose();
  });

  it('gives a storey raised over a slabbed one a floor of its own', () => {
    const store = new SitePlannerStore(createRepository());

    layOutHouse(store);
    store.addStoreyToEditedBuilding({ copyWalls: false });
    store.placeSlabAt({ x: 10, y: 10 });
    store.addStoreyToEditedBuilding({ copyWalls: false });

    const slabs = store.activeStoreySlabs;

    expect(slabs).toHaveLength(1);
    // Copied, not shared: sizing the third floor must not resize the second.
    expect(slabs[0].id).not.toBe(storeysOf(store.buildings[0])[1].slabs?.[0].id);

    store.dispose();
  });

  it('crowns the building with a roof that re-cuts itself onto the top storey', () => {
    const store = new SitePlannerStore(createRepository());

    layOutHouse(store);
    store.togglePitchedRoof();

    const ground = store.buildingScenes[0].pitchedRoof;

    // A 10 × 8 house: the ridge runs along the longer side by default.
    expect(ground?.roof.ridgeDegrees).toBe(0);
    expect(ground?.faces).toHaveLength(2);

    const groundRidge = ground?.ridgeElevation;

    store.addStoreyToEditedBuilding({ copyWalls: false });
    store.placeSlabAt({ x: 10, y: 10 });

    const raised = store.buildingScenes[0].pitchedRoof;

    // The roof now stands on the second storey's slab, higher and smaller.
    expect(raised?.ridgeElevation ?? 0).toBeGreaterThan(groundRidge ?? 0);
    expect(multiPolygonArea(raised?.footprint ?? [])).toBeCloseTo(24);

    store.togglePitchedRoof();

    expect(store.buildingScenes[0].pitchedRoof).toBeUndefined();

    store.dispose();
  });

  it('draws the roof in one pass only — with the storey it crowns', () => {
    const store = new SitePlannerStore(createRepository());
    const vertexCount = (mesh: { readonly positions: Float32Array } | undefined): number =>
      mesh?.positions.length ?? 0;

    layOutHouse(store);
    store.addStoreyToEditedBuilding({ copyWalls: true });
    store.placeSlabAt({ x: 10, y: 10 });
    store.setActiveStorey(storeysOf(store.buildings[0])[0].id);

    const solidBefore = vertexCount(store.buildingsGeometry);
    const ghostBefore = vertexCount(store.buildingsGhostGeometry);

    store.togglePitchedRoof();

    // The roof crowns the TOP storey, which is not the one being edited: it
    // belongs to the ghosted pass, and to that pass alone. Emitting it in both
    // drew every roof and every chimney twice, blended over itself.
    expect(vertexCount(store.buildingsGeometry)).toBe(solidBefore);
    expect(vertexCount(store.buildingsGhostGeometry)).toBeGreaterThan(ghostBefore);

    store.dispose();
  });

  it('carries a fireplace flue through the storey above and out over the roof', () => {
    const store = new SitePlannerStore(createRepository());

    layOutHouse(store);
    store.togglePitchedRoof();
    store.placeFireplaceAt({ x: 10, y: 10 });
    store.addStoreyToEditedBuilding({ copyWalls: false });
    store.placeSlabAt({ x: 10, y: 10 });

    const [scene] = store.buildingScenes;
    const [ground, upper] = scene.storeys;

    expect(ground.fireplaces).toHaveLength(1);
    // The flue starts below and PASSES THROUGH the floor above it.
    expect(ground.ducts[0]).toMatchObject({ startsHere: true });
    expect(upper.ducts[0]).toMatchObject({ startsHere: false });
    // Which is why that floor is opened for it.
    expect(upper.ductCutouts).toHaveLength(1);

    const [run] = scene.ducts;
    const ridge = scene.pitchedRoof?.ridgeElevation ?? 0;

    // Standing on the ridge line, it comes out half a metre above it.
    expect(run.topElevation).toBeCloseTo(ridge + 0.5);
    expect(run.isOutsideRoof).toBe(false);

    store.dispose();
  });

  it('asks a sauna for a shaft of its own and stops once it has one', () => {
    const store = new SitePlannerStore(createRepository());

    const building = layOutHouse(store);

    drawUpperRing(store);

    const room = store.buildingScenes[0].storeys[0].rooms[0];

    store.setRoomType(building.id, room, 'sauna');

    const complaints = () =>
      store.buildingWarnings.filter(warning => warning.kind === 'room-without-exhaust');

    expect(complaints()).toHaveLength(1);

    store.placeDuctAt({ x: 10, y: 10 });

    expect(complaints()).toHaveLength(0);

    store.dispose();
  });

  it('reads a legacy single-floor building as one ground storey', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutHouse(store);

    store.appendDraftWallPoint({ x: 5, y: 10 });
    store.appendDraftWallPoint({ x: 15, y: 10 });
    store.commitDraftWall();

    const storeys = storeysOf(store.buildings[0]);

    expect(storeys).toHaveLength(1);
    expect(storeys[0].walls).toHaveLength(1);
    expect(storeys[0].heightMeters).toBe(store.buildings[0].wallHeight);
    expect(building.id).toBe(store.buildings[0].id);

    store.dispose();
  });

  it('raises a second storey, aims the editor at it and builds on it', () => {
    const store = new SitePlannerStore(createRepository());

    layOutHouse(store);
    store.addStoreyToEditedBuilding({ copyWalls: false });

    const storeys = storeysOf(store.buildings[0]);

    expect(storeys).toHaveLength(2);
    expect(store.activeStoreyId).toBe(storeys[1].id);

    drawUpperRing(store);

    const updated = storeysOf(store.buildings[0]);

    expect(updated[1].walls).toHaveLength(1);
    expect(updated[0].walls).toHaveLength(0);

    store.dispose();
  });

  it('derives the upper footprint from its walls and zones the rest as ceiling', () => {
    const store = new SitePlannerStore(createRepository());
    const building = layOutHouse(store);

    store.addStoreyToEditedBuilding({ copyWalls: false });
    drawUpperRing(store);

    const [scene] = store.buildingScenes;
    const [ground, upper] = scene.storeys;

    // The надстройка's footprint is the ring the walls close.
    expect(upper.footprint.length).toBeGreaterThan(0);

    // The rest of the ground floor's ceiling is exposed — the terrace-to-be.
    expect(ground.roofZones.length).toBeGreaterThan(0);

    const [zone] = ground.roofZones;

    expect(zone.cover).toBe('membrane');

    store.setRoofCover(building.id, zone, 'terrace');

    expect(store.buildingScenes[0].storeys[0].roofZones[0].cover).toBe('terrace');

    // Choosing the membrane back clears the label.
    store.setRoofCover(building.id, store.buildingScenes[0].storeys[0].roofZones[0], 'membrane');

    expect(store.buildingScenes[0].storeys[0].roofZones[0].cover).toBe('membrane');
    expect(storeysOf(store.buildings[0])[0].roofZoneLabels).toHaveLength(0);

    store.dispose();
  });

  it('copies the walls of the storey below into the raised one, with new identities', () => {
    const store = new SitePlannerStore(createRepository());

    layOutHouse(store);
    store.appendDraftWallPoint({ x: 5, y: 10 });
    store.appendDraftWallPoint({ x: 15, y: 10 });
    store.commitDraftWall();

    store.addStoreyToEditedBuilding({ copyWalls: true });

    const [ground, upper] = storeysOf(store.buildings[0]);

    expect(upper.walls).toHaveLength(1);
    expect(upper.walls[0].points).toEqual(ground.walls[0].points);
    expect(upper.walls[0].id).not.toBe(ground.walls[0].id);

    store.dispose();
  });

  it('takes an upper storey down but refuses the ground one', () => {
    const store = new SitePlannerStore(createRepository());

    layOutHouse(store);
    store.addStoreyToEditedBuilding({ copyWalls: false });

    const storeys = storeysOf(store.buildings[0]);

    store.removeStoreyFromEdited(storeys[1].id);

    expect(storeysOf(store.buildings[0])).toHaveLength(1);
    expect(store.activeStoreyId).toBe(storeysOf(store.buildings[0])[0].id);

    store.removeStoreyFromEdited(storeysOf(store.buildings[0])[0].id);

    expect(storeysOf(store.buildings[0])).toHaveLength(1);

    store.dispose();
  });

  it('seeds a carport preset on piers with a lower roof', () => {
    const store = new SitePlannerStore(createRepository());

    store.enterEditMode({ kind: 'site' });

    const carport = store.addBuilding('Навес', 'carport');

    expect(foundationOf(carport).kind).toBe('pier');
    expect(carport.wallHeight).toBeCloseTo(2.4);

    store.dispose();
  });
});

describe('SitePlannerStore wall drawing precision', () => {
  const openWallTool = (store: SitePlannerStore) => {
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 20, length: 20, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });
    store.setActiveTool('building:wall');
    store.appendDraftWallPoint({ x: 5, y: 5 });

    return building;
  };

  it('previews nothing until a first corner is planted', () => {
    const store = new SitePlannerStore(createRepository());

    store.setCursorPlanPoint({ x: 3, y: 3 });

    expect(store.draftWallCursor).toBeUndefined();
    expect(store.draftWallReadout).toBeUndefined();

    store.dispose();
  });

  it('reads out the length and angle of the segment in flight', () => {
    const store = new SitePlannerStore(createRepository());

    openWallTool(store);
    store.setCursorPlanPoint({ x: 9, y: 5 });

    expect(store.draftWallReadout?.lengthMeters).toBeCloseTo(4);
    expect(store.draftWallReadout?.angleDegrees).toBeCloseTo(0);

    store.dispose();
  });

  it('locks the segment square while Shift is held', () => {
    const store = new SitePlannerStore(createRepository());

    openWallTool(store);
    store.setCursorPlanPoint({ x: 9, y: 5.3 });
    store.setCursorModifiers({ isAltPressed: false, isShiftPressed: true });

    expect(store.draftWallCursor?.y).toBeCloseTo(5);

    store.dispose();
  });

  it('takes the exact length typed into the value box', () => {
    const store = new SitePlannerStore(createRepository());

    openWallTool(store);
    store.setCursorPlanPoint({ x: 9.37, y: 5 });
    for (const key of ['4', '.', '2']) {
      store.appendTypedLengthKey(key);
    }

    expect(store.typedLengthMeters).toBeCloseTo(4.2);
    expect(store.draftWallCursor?.x).toBeCloseTo(9.2);

    store.dispose();
  });

  it('peels the last corner back', () => {
    const store = new SitePlannerStore(createRepository());

    openWallTool(store);
    store.appendDraftWallPoint({ x: 9, y: 5 });

    expect(store.draftWallPoints).toHaveLength(2);

    store.dropLastDraftWallPoint();

    expect(store.draftWallPoints).toHaveLength(1);

    store.dispose();
  });
});

describe('SitePlannerStore storey navigation', () => {
  const openBuilding = (store: SitePlannerStore) => {
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 20, length: 20, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });

    return building;
  };

  it('keeps the building session and the active storey across the 3D view', () => {
    const store = new SitePlannerStore(createRepository());

    openBuilding(store);
    store.addStoreyToEditedBuilding({ copyWalls: false });

    const activeStoreyId = store.activeStoreyId;

    store.setViewMode('scene');

    expect(store.editorMode.kind).toBe('edit');
    expect(store.activeStoreyId).toBe(activeStoreyId);

    store.setViewMode('plan');

    expect(store.activeStoreyOrdinal).toBe(2);

    store.dispose();
  });

  it('steps between storeys and stops at the ends of the stack', () => {
    const store = new SitePlannerStore(createRepository());

    openBuilding(store);
    store.addStoreyToEditedBuilding({ copyWalls: false });

    expect(store.activeStoreyOrdinal).toBe(2);

    store.stepActiveStorey(-1);

    expect(store.activeStoreyOrdinal).toBe(1);

    store.stepActiveStorey(-1);

    expect(store.activeStoreyOrdinal).toBe(1);

    store.dispose();
  });

  it('ghosts only the storeys the editor is not aimed at', () => {
    const store = new SitePlannerStore(createRepository());

    openBuilding(store);

    expect(store.buildingsGhostGeometry).toBeUndefined();

    store.dispose();
  });
});

describe('SitePlannerStore stairs', () => {
  const openTwoStoreyBuilding = (store: SitePlannerStore) => {
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 20, length: 20, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });
    store.addStoreyToEditedBuilding({ copyWalls: false });
    store.stepActiveStorey(-1);

    return building;
  };

  it('places a stair on the active storey and derives its run', () => {
    const store = new SitePlannerStore(createRepository());

    openTwoStoreyBuilding(store);
    store.setActiveTool('building:stair');
    store.placeStairAt({ x: 6, y: 6 });

    const scene = store.editedStoreyScene;

    expect(scene?.stairs).toHaveLength(1);
    expect(scene?.stairs[0].run.riserCount).toBeGreaterThan(10);
    expect(scene?.stairs[0].steps.length).toBeGreaterThan(0);

    store.dispose();
  });

  it('opens the stairwell in the floor of the storey above, not its own', () => {
    const store = new SitePlannerStore(createRepository());

    openTwoStoreyBuilding(store);
    store.placeStairAt({ x: 6, y: 6 });
    store.stepActiveStorey(1);

    const upper = store.editedStoreyScene;

    expect(upper?.stairCutouts.length).toBeGreaterThan(0);
    expect(upper?.ownStairCutouts).toHaveLength(0);

    store.dispose();
  });

  it('re-derives the run when the storey height changes', () => {
    const store = new SitePlannerStore(createRepository());

    openTwoStoreyBuilding(store);
    store.placeStairAt({ x: 6, y: 6 });

    const before = store.editedStoreyScene?.stairs[0].run.riserCount ?? 0;
    const storeyId = store.activeStoreyId;

    assert(storeyId !== undefined, 'expected an active storey');
    store.setStoreyHeightOnEdited(storeyId, 3.4);

    expect(store.editedStoreyScene?.stairs[0].run.riserCount).toBeGreaterThan(before);

    store.dispose();
  });

  it('takes the stair down with the storey it climbed into', () => {
    const store = new SitePlannerStore(createRepository());

    openTwoStoreyBuilding(store);
    store.placeStairAt({ x: 6, y: 6 });
    store.stepActiveStorey(1);

    const upperStoreyId = store.activeStoreyId;

    assert(upperStoreyId !== undefined, 'expected the upper storey to be active');
    store.removeStoreyFromEdited(upperStoreyId);

    expect(store.editedStoreyScene?.stairs).toHaveLength(0);

    store.dispose();
  });
});

describe('SitePlannerStore external stairs', () => {
  it('turns a stair placed outside the footprint into a porch from the ground', () => {
    const store = new SitePlannerStore(createRepository());
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 8, length: 8, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });
    // Well outside the 8×8 footprint centred on (10, 10).
    store.placeStairAt({ x: 18, y: 10 });

    const porch = store.editedStoreyScene?.stairs[0];

    assert(porch !== undefined, 'expected the porch to be placed');
    expect(porch.isExternal).toBe(true);
    // A porch climbs the цоколь, not a whole storey: a handful of steps.
    expect(porch.run.riserCount).toBeLessThan(6);
    // And it pierces nothing — there is no floor above it to open.
    expect(porch.cutout).toHaveLength(0);

    store.dispose();
  });

  it('keeps a stair inside the footprint climbing the whole storey', () => {
    const store = new SitePlannerStore(createRepository());
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 8, length: 8, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });
    store.placeStairAt({ x: 10, y: 10 });

    const inner = store.editedStoreyScene?.stairs[0];

    assert(inner !== undefined, 'expected the stair to be placed');
    expect(inner.isExternal).toBe(false);
    expect(inner.run.riserCount).toBeGreaterThan(10);

    store.dispose();
  });
});

describe('SitePlannerStore supports', () => {
  const openCanopy = (store: SitePlannerStore) => {
    const building = store.addBuilding('Навес');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 6, length: 6, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });

    return building;
  };

  it('spans a post inside the footprint from the floor to the ceiling', () => {
    const store = new SitePlannerStore(createRepository());

    openCanopy(store);
    store.placeSupportAt({ x: 10, y: 10 });

    const post = store.editedStoreyScene?.supports[0];

    assert(post !== undefined, 'expected the post to be placed');
    assert(post.baseElevation !== undefined && post.topElevation !== undefined, 'expected a span');
    expect(post.isFreeStanding).toBe(false);
    expect(post.topElevation - post.baseElevation).toBeCloseTo(
      store.editedStoreyScene?.storey.heightMeters ?? 0
    );

    store.dispose();
  });

  it('stands a post outside the footprint on the ground, reaching the same ceiling', () => {
    const store = new SitePlannerStore(createRepository());

    openCanopy(store);
    store.placeSupportAt({ x: 10, y: 10 });
    store.placeSupportAt({ x: 16, y: 10 });

    const [inner, outer] = store.editedStoreyScene?.supports ?? [];

    assert(inner?.topElevation !== undefined && outer?.topElevation !== undefined, 'spans');
    expect(outer.isFreeStanding).toBe(true);
    // One ceiling datum for both, so a deck laid over them stays level.
    expect(outer.topElevation).toBeCloseTo(inner.topElevation);

    store.dispose();
  });

  it('takes a post away again', () => {
    const store = new SitePlannerStore(createRepository());

    const building = openCanopy(store);

    store.placeSupportAt({ x: 10, y: 10 });

    const post = store.editedStoreyScene?.supports[0];

    assert(post !== undefined, 'expected the post');
    store.removeSupportFrom(building.id, post.post.id);

    expect(store.editedStoreyScene?.supports).toHaveLength(0);

    store.dispose();
  });
});

describe('SitePlannerStore building warnings', () => {
  const openHouse = (store: SitePlannerStore) => {
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 10, length: 10, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });

    return building;
  };

  it('says nothing about a plain house', () => {
    const store = new SitePlannerStore(createRepository());

    openHouse(store);

    expect(store.buildingWarnings).toHaveLength(0);

    store.dispose();
  });

  it('flags a storey nobody could live on and clears it when raised', () => {
    const store = new SitePlannerStore(createRepository());

    openHouse(store);

    const storeyId = store.activeStoreyId;

    assert(storeyId !== undefined, 'expected an active storey');
    store.setStoreyHeightOnEdited(storeyId, 1.9);

    expect(store.buildingWarnings.some(warning => warning.kind === 'storey-too-low')).toBe(true);

    store.setStoreyHeightOnEdited(storeyId, 2.7);

    expect(store.buildingWarnings).toHaveLength(0);

    store.dispose();
  });

  it('flags a stair whose steps left the bands', () => {
    const store = new SitePlannerStore(createRepository());

    openHouse(store);

    const storeyId = store.activeStoreyId;

    assert(storeyId !== undefined, 'expected an active storey');
    // A very low storey makes any stair in it absurd.
    store.setStoreyHeightOnEdited(storeyId, 0.4);
    store.placeStairAt({ x: 10, y: 10 });

    expect(store.buildingWarnings.some(warning => warning.kind === 'stair-uncomfortable')).toBe(
      true
    );

    store.dispose();
  });

  it('takes the editor to the storey and place a finding is about', () => {
    const store = new SitePlannerStore(createRepository());

    openHouse(store);

    const storeyId = store.activeStoreyId;

    assert(storeyId !== undefined, 'expected an active storey');
    store.setStoreyHeightOnEdited(storeyId, 1.9);

    const [finding] = store.buildingWarnings;

    assert(finding !== undefined, 'expected a finding');
    store.revealWarning(finding);

    expect(store.viewMode).toBe('plan');
    expect(store.activeStoreyId).toBe(finding.storeyId);
    expect(store.viewport.centerMeters).toEqual(finding.at);

    store.dispose();
  });
});

describe('SitePlannerStore stair as an object', () => {
  const placeStair = (store: SitePlannerStore) => {
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 12, length: 12, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });
    store.placeStairAt({ x: 10, y: 10 });

    const stair = store.editedStoreyScene?.stairs[0];

    assert(stair !== undefined, 'expected the stair');

    return { building, stairId: stair.stair.id };
  };

  it('moves a stair, and its footprint follows', () => {
    const store = new SitePlannerStore(createRepository());
    const { building, stairId } = placeStair(store);
    const before = store.editedStoreyScene?.stairs[0].footprint[0].outer[0];

    store.moveStair(building.id, stairId, { position: { x: 6, y: 6 } });

    const after = store.editedStoreyScene?.stairs[0].footprint[0].outer[0];

    expect(store.editedStoreyScene?.stairs[0].stair.position).toEqual({ x: 6, y: 6 });
    expect(after).not.toEqual(before);

    store.dispose();
  });

  it('turns a stair, and its exit turns with it', () => {
    const store = new SitePlannerStore(createRepository());
    const { building, stairId } = placeStair(store);
    const before = store.editedStoreyScene?.stairs[0].exitPoint;

    store.moveStair(building.id, stairId, { rotationDegrees: 90 });

    expect(store.editedStoreyScene?.stairs[0].exitPoint).not.toEqual(before);

    store.dispose();
  });

  it('mirrors a stair to its other hand and back', () => {
    const store = new SitePlannerStore(createRepository());
    const { building, stairId } = placeStair(store);

    store.mirrorStair(building.id, stairId);

    expect(store.editedStoreyScene?.stairs[0].stair.isMirrored).toBe(true);

    store.mirrorStair(building.id, stairId);

    expect(store.editedStoreyScene?.stairs[0].stair.isMirrored).toBe(false);

    store.dispose();
  });

  it('mirrors an l-shaped stair onto the other side of its climb', () => {
    const store = new SitePlannerStore(createRepository());
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 12, length: 12, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });
    store.setArmedStairKind('l-shaped');
    store.placeStairAt({ x: 10, y: 10 });

    const stair = store.editedStoreyScene?.stairs[0];

    assert(stair !== undefined, 'expected the stair');

    const before = stair.exitPoint.x;

    store.mirrorStair(building.id, stair.stair.id);

    const after = store.editedStoreyScene?.stairs[0].exitPoint.x ?? before;

    // The quarter turn now goes the other way: the exit swaps sides of the
    // stair's own axis.
    expect(Math.sign(after - 10)).toBe(-Math.sign(before - 10));

    store.dispose();
  });
});

describe('SitePlannerStore multiple selection', () => {
  const openWithTwoStairs = (store: SitePlannerStore) => {
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 16, length: 16, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });
    store.placeStairAt({ x: 6, y: 6 });
    store.placeStairAt({ x: 14, y: 14 });

    const stairs = store.editedStoreyScene?.stairs ?? [];

    assert(stairs.length === 2, 'expected two stairs');

    return {
      building,
      first: { kind: 'stair' as const, buildingId: building.id, stairId: stairs[0].stair.id },
      second: { kind: 'stair' as const, buildingId: building.id, stairId: stairs[1].stair.id },
    };
  };

  it('adds to and takes back out of the selection', () => {
    const store = new SitePlannerStore(createRepository());
    const { first, second } = openWithTwoStairs(store);

    store.setSelection(first);
    store.toggleSelection(second);

    expect(store.selections).toHaveLength(2);
    expect(store.isSelected(first)).toBe(true);
    // The last one picked is what the properties panel reads.
    expect(store.selection).toEqual(second);

    store.toggleSelection(second);

    expect(store.selections).toHaveLength(1);
    expect(store.isSelected(second)).toBe(false);

    store.dispose();
  });

  it('deletes everything selected in one step', () => {
    const store = new SitePlannerStore(createRepository());
    const { first, second } = openWithTwoStairs(store);

    store.setSelections([first, second]);
    store.removeSelected();

    expect(store.editedStoreyScene?.stairs).toHaveLength(0);

    store.undo();

    expect(store.editedStoreyScene?.stairs).toHaveLength(2);

    store.dispose();
  });

  it('duplicates the selection a step away and selects the copies', () => {
    const store = new SitePlannerStore(createRepository());
    const { first, second } = openWithTwoStairs(store);

    store.setSelections([first, second]);
    store.duplicateSelected();

    expect(store.editedStoreyScene?.stairs).toHaveLength(4);
    expect(store.selections).toHaveLength(2);
    expect(store.isSelected(first)).toBe(false);

    const positions = (store.editedStoreyScene?.stairs ?? []).map(stair => stair.stair.position);

    // The copies stand a grid step along, not exactly under the originals.
    expect(new Set(positions.map(point => `${point.x}:${point.y}`)).size).toBe(4);

    store.dispose();
  });
});

describe('SitePlannerStore stair rotation', () => {
  const placeStair = (store: SitePlannerStore) => {
    const building = store.addBuilding('Дом');

    store.addShapeTerm(
      building.id,
      createRectangle({ center: { x: 10, y: 10 }, width: 12, length: 12, rotationDegrees: 0 }),
      'union'
    );
    store.enterEditMode({ kind: 'building', buildingId: building.id });
    store.placeStairAt({ x: 10, y: 10 });

    const stair = store.editedStoreyScene?.stairs[0];

    assert(stair !== undefined, 'expected the stair');

    return { building, stairId: stair.stair.id };
  };

  it('turns a stair a quarter at a time and comes full circle', () => {
    const store = new SitePlannerStore(createRepository());
    const { building, stairId } = placeStair(store);

    store.rotateStairByQuarter(building.id, stairId);

    expect(store.editedStoreyScene?.stairs[0].stair.rotationDegrees).toBe(90);

    for (let turn = 0; turn < 3; turn += 1) {
      store.rotateStairByQuarter(building.id, stairId);
    }

    expect(store.editedStoreyScene?.stairs[0].stair.rotationDegrees).toBe(0);

    store.dispose();
  });

  it('takes the exit and the turn grip round with the stair', () => {
    const store = new SitePlannerStore(createRepository());
    const { building, stairId } = placeStair(store);
    const before = store.editedStoreyScene?.stairs[0];

    assert(before !== undefined, 'expected the stair');

    const exitBefore = before.exitPoint;
    const gripBefore = before.rotationGrip;

    store.rotateStairByQuarter(building.id, stairId);

    const after = store.editedStoreyScene?.stairs[0];

    expect(after?.exitPoint).not.toEqual(exitBefore);
    expect(after?.rotationGrip).not.toEqual(gripBefore);
    // The grip keeps its distance from the exit through the turn.
    assert(after !== undefined, 'expected the turned stair');
    expect(
      Math.hypot(after.rotationGrip.x - after.exitPoint.x, after.rotationGrip.y - after.exitPoint.y)
    ).toBeCloseTo(Math.hypot(gripBefore.x - exitBefore.x, gripBefore.y - exitBefore.y));

    store.dispose();
  });

  it('undoes a quarter turn as one step', () => {
    const store = new SitePlannerStore(createRepository());
    const { building, stairId } = placeStair(store);

    store.rotateStairByQuarter(building.id, stairId);
    store.undo();

    expect(store.editedStoreyScene?.stairs[0].stair.rotationDegrees).toBe(0);

    store.dispose();
  });
});
