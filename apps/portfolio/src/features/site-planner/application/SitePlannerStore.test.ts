import { assert } from '@frozik/utils/assert/assert';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
