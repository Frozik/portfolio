import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp, isNil } from 'lodash-es';
import { offsetAlongOutline, pointOnOutline } from '../../domain/geometry/building-outline';
import { TYPED_LENGTH_KEY_PATTERN } from '../../domain/geometry/draw-constraints';
import { magnetizeFurnitureToWall } from '../../domain/geometry/furniture-magnetism';
import { distanceToPolyline } from '../../domain/geometry/hit-test-objects';
import type { RotatedBox } from '../../domain/geometry/hit-test-shape';
import { hitTestRotatedBox, hitTestShape } from '../../domain/geometry/hit-test-shape';
import { clampPointToMultiPolygon } from '../../domain/geometry/polygon-booleans';
import { isPointOnStair } from '../../domain/geometry/stair-footprint';
import {
  pointAlongPolyline,
  polylineLength,
  projectOntoPolyline,
  wallCenterline,
} from '../../domain/geometry/wall-geometry';
import { findBuilding as findBuildingIn } from '../../domain/model/building-edits';
import type { VerticalDuct } from '../../domain/model/ducts';
import type { ElectricalDevice } from '../../domain/model/electrical';
import type { Fireplace } from '../../domain/model/fireplaces';
import { FIREPLACE_SPECS } from '../../domain/model/fireplaces';
import { canEnterThroughFloor } from '../../domain/model/foundation';
import type { FurnitureInstance } from '../../domain/model/furniture';
import { findFurnitureEntry, furnitureBox } from '../../domain/model/furniture';
import type { Opening } from '../../domain/model/openings';
import type { Selection } from '../../domain/model/selection';
import type { BuildingId } from '../../domain/model/site-plan';
import { entriesOf, storeysOf } from '../../domain/model/site-plan';
import type { Slab } from '../../domain/model/slabs';
import type { StairInstance } from '../../domain/model/stairs';
import type { Storey } from '../../domain/model/storeys';
import { devicesOf, furnitureOf } from '../../domain/model/storeys';
import type { SupportPost } from '../../domain/model/supports';
import type { JunctionEdge } from '../../domain/model/wall-topology';
import { edgeJunctionVertexIndex } from '../../domain/model/wall-topology';
import type { Wall, WallId } from '../../domain/model/walls';
import { isWallClosed, MIN_CLOSED_WALL_POINTS } from '../../domain/model/walls';
import type { Meters } from '../../domain/units';
import { normalizeTurnDegrees } from '../../domain/units';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { computeFurnitureHandles } from '../render/plan-draw/draw-furniture';
import { computePolylinePointHandles, findPathPointHandleAt } from '../render/plan-draw/draw-paths';
import type { SitePlannerStore } from '../SitePlannerStore';
import type { EditorInteraction, InteractionContext } from './editor-interaction';
import { gridStep, snapPointToGrid } from './grid-snapping';
import type { DraggedObject } from './object-drag-gestures';
import { ObjectDragGestures } from './object-drag-gestures';
import { findHandleAt, HANDLE_HIT_RADIUS_PX } from './plan-picking';
import { ShapeGestures } from './shape-gestures';
import { applyWallHandleHover, WallPointGestures } from './wall-point-gestures';

/** How far outside its body a wall still answers a click, in pixels. */
const WALL_PICK_TOLERANCE_PX = 6;
/** How near a wall face pulls a dragged piece flush against it, in metres. */
const FURNITURE_MAGNET_RADIUS_METERS = 0.5;
/** The grab radius around a device symbol, generous around the drawn glyph. */
const DEVICE_PICK_RADIUS_PX = 10;
/** Дальше этого от контура утащенный ввод уходит в плиту, ближе — липнет к краю. */
const ENTRY_OUTLINE_STICK_RADIUS_PX = 14;

/**
 * The building editor's canvas behaviour:
 * the wall tool clicks out reference polylines, the select tool takes hold of
 * a wall or one of its drawn points. Openings and rooms join here with the
 * next slice of the stage.
 */
export class BuildingEditInteraction implements EditorInteraction {
  private readonly context: InteractionContext;
  private readonly buildingId: BuildingId;
  private readonly wallGestures: WallPointGestures;
  private readonly slabs: ShapeGestures<void>;
  private readonly objects: ObjectDragGestures;
  /** «D + цифра»: the edge's end torn off its junction, riding the pointer. */
  private detachCarry:
    | { readonly wallId: WallId; readonly pointIndex: number; readonly restore: () => void }
    | undefined = undefined;
  /** The `D` half of «D + цифра» was pressed; the next digit detaches. */
  private isDetachArmed = false;

  constructor(context: InteractionContext, buildingId: BuildingId) {
    this.context = context;
    this.buildingId = buildingId;
    this.wallGestures = new WallPointGestures(context, buildingId);
    this.objects = new ObjectDragGestures(context);
    // Everything on a storey is drawn against walls that are already standing,
    // so the object snap is live without a modifier here — the OSNAP habit the
    // wall tool already follows. A slab is caught by
    // the corners and side middles of the storey BELOW as well as by its own
    // storey's, which is what makes «flush with the room downstairs» a gesture
    // rather than four typed numbers.
    this.slabs = new ShapeGestures<void>(context, {
      isSnapAlwaysLive: true,
      update: slab => context.store.storeyObjects.updateSlab(buildingId, slab),
      add: slab => {
        context.store.storeyObjects.addSlab(slab);
        context.store.finishPlacement();
      },
      snapPoints: excludedShapeId => context.store.storeyObjects.slabSnapPoints(excludedShapeId),
    });
  }

  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store } = this.context;

    // A detach in flight plants where the press lands; nothing else answers.
    if (!isNil(this.detachCarry)) {
      this.plantDetachedVertex(planPoint, modifiers);

      return true;
    }

    switch (store.activeTool) {
      case 'select':
        // A press re-aims the break UI: the junction it lands on re-selects
        // on release, any other target leaves no junction selected.
        store.walls.selectJunction(undefined);
        this.beginSelectGesture(planPoint, modifiers);

        return true;
      case 'building:wall':
        // The ground storey stands on the foundation, so a click past the
        // slab lands on its edge; an upper storey may overhang (R24).
        // `draftWallCursor` is the previewed corner — angle lock and typed
        // length included — so what the rubber band showed is what lands.
        store.walls.appendDraftWallPoint(
          store.walls.clampWallPoint(
            this.buildingId,
            store.walls.draftWallCursor ?? store.walls.firstWallPointAt(planPoint)
          )
        );
        store.walls.setTypedLengthText(undefined);

        return true;
      case 'building:opening':
        // Nothing lands when the click missed every wall, and a tool that
        // placed nothing must stay in hand rather than quietly give up.
        if (this.placeOpening(planPoint)) {
          store.finishPlacement();
        }

        return true;
      case 'building:slab':
        // Drawn like any shape on the plot — the armed primitive, dragged out.
        // A click that never moved lays a plate of a sensible default size, so
        // the tool answers both ways of asking for a floor.
        this.slabs.beginDraw(store.armedShapeTool, undefined, planPoint, modifiers);

        return true;
      case 'building:fireplace':
        // A fireplace is placed like a stair: one click says where, and its
        // flue derives from there up through the roof.
        store.storeyObjects.placeFireplaceAt(snapPointToGrid(store, planPoint, modifiers));
        store.finishPlacement();

        return true;
      case 'building:duct':
        store.storeyObjects.placeDuctAt(snapPointToGrid(store, planPoint, modifiers));
        store.finishPlacement();

        return true;
      case 'building:support':
        // A post is placed like a socket: one click, both ends derived.
        store.storeyObjects.placeSupportAt(snapPointToGrid(store, planPoint, modifiers));
        store.finishPlacement();

        return true;
      case 'building:stair':
        // A stair is placed, not drawn: its run comes from the storey height,
        // so the click only says where. Snapping keeps it off half-metres.
        store.storeyObjects.placeStairAt(snapPointToGrid(store, planPoint, modifiers));
        store.finishPlacement();

        return true;
      // Furniture and electrics are STICKY: a room is furnished and a storey
      // wired by placing one piece after another, so these two tools stay in
      // hand. The piece that lands is still selected, so its properties are
      // there to type — only the tool is not taken away.
      case 'building:furniture':
        store.storeyObjects.placeFurnitureAt(
          this.buildingId,
          snapPointToGrid(store, planPoint, modifiers)
        );

        return true;
      case 'building:electric':
        this.placeDevice(planPoint, modifiers);

        return true;
      case 'building:connect':
        this.pickForConnect(planPoint);

        return true;
      default:
        return false;
    }
  }

  onPointerMove(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const carry = this.detachCarry;

    if (!isNil(carry)) {
      this.context.store.walls.moveWallPoint(
        this.buildingId,
        carry.wallId,
        carry.pointIndex,
        this.context.store.walls.clampWallPoint(
          this.buildingId,
          snapPointToGrid(this.context.store, planPoint, modifiers)
        )
      );

      return true;
    }

    if (this.objects.move(planPoint, modifiers) || this.slabs.move(planPoint, modifiers)) {
      return true;
    }

    if (this.wallGestures.move(planPoint, modifiers)) {
      return true;
    }

    // With the select tool idle over the selected wall, the handles announce
    // themselves — and the event is spent, or the shell would clear the hover.
    if (
      this.context.store.activeTool === 'select' &&
      !isNil(this.context.store.walls.selectedWall)
    ) {
      applyWallHandleHover(this.context, planPoint);

      return true;
    }

    return false;
  }

  onPointerUp(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (this.objects.release(planPoint, modifiers)) {
      return true;
    }

    if (this.slabs.release(planPoint, modifiers)) {
      // A press and a release with nothing in between is the click that lays a
      // default plate; the gesture itself has nothing to commit.
      if (!this.context.hasPointerMoved() && this.context.store.activeTool === 'building:slab') {
        this.context.store.storeyObjects.placeSlabAt(
          snapPointToGrid(this.context.store, planPoint, modifiers)
        );
        this.context.store.finishPlacement();
      }

      return true;
    }

    if (!this.wallGestures.release(planPoint, modifiers)) {
      return false;
    }

    // A dragged endpoint that landed on its opposite end has closed the
    // contour; the release is what seals the ring.
    this.sealRingIfEndsMeet();
    applyWallHandleHover(this.context, planPoint);

    return true;
  }

  /** Closes the selected wall once its two ends stand on one point. */
  private sealRingIfEndsMeet(): void {
    const { store } = this.context;
    const wall = store.walls.selectedWall;

    if (isNil(wall) || isWallClosed(wall) || wall.points.length < MIN_CLOSED_WALL_POINTS + 1) {
      return;
    }

    const [first] = wall.points;
    const last = wall.points[wall.points.length - 1];

    if (first.x === last.x && first.y === last.y) {
      store.walls.closeWallRing(this.buildingId, wall.id);
    }
  }

  onPointerCancel(): void {
    this.cancelDetach();
    this.objects.cancel();
    this.slabs.cancel();
    this.wallGestures.cancel();
  }

  /**
   * Commits the polyline being clicked out; on a corner of the selected wall
   * it edits the contour — plain removes the corner, Alt CUTS there (a ring
   * opens, an open wall splits in two); over emptiness it closes the editor.
   */
  onDoubleClick(planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;

    if (store.walls.draftWallPoints.length > 0) {
      store.walls.commitDraftWall();

      return;
    }

    if (this.editWallCornerAt(planPoint, modifiers)) {
      return;
    }

    if (isNil(this.pickWall(planPoint))) {
      store.exitEditMode();
    }
  }

  /** The corner the double click landed on, removed — or cut with Alt held. */
  private editWallCornerAt(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store, getViewport } = this.context;
    const wall = store.walls.selectedWall;

    if (isNil(wall)) {
      return false;
    }

    const viewport = getViewport();
    const handle = findPathPointHandleAt(
      computePolylinePointHandles(wall.points, viewport, {
        includeMidpoints: true,
        isClosed: isWallClosed(wall),
      }),
      planToScreen(viewport, planPoint),
      HANDLE_HIT_RADIUS_PX
    );

    if (isNil(handle) || handle.kind !== 'vertex') {
      return false;
    }

    // The double click's presses have already grabbed the point and announced
    // a step; what the gesture turns out to have been is this edit.
    this.wallGestures.drop();

    if (modifiers.isAltPressed) {
      store.walls.cutWallAtPoint(this.buildingId, wall.id, handle.index);
    } else {
      store.walls.removeWallPoint(this.buildingId, wall.id, handle.index);
    }

    // The gone point's highlight would light its successor by index.
    store.setPathHandleHighlight(undefined);

    return true;
  }

  onKeyDown(key: string, _modifiers: PlanModifiers): boolean {
    const { store } = this.context;

    if (this.onJunctionKey(key)) {
      return true;
    }

    if (key === 'Enter' && store.walls.draftWallPoints.length > 0) {
      store.walls.commitDraftWall();

      return true;
    }

    if (store.walls.draftWallPoints.length === 0) {
      return false;
    }

    // The CAD value-control box: aim roughly, then state the length. Digits
    // and one separator accumulate; Backspace peels the number back and, once
    // it is empty, takes the last corner with it.
    if (TYPED_LENGTH_KEY_PATTERN.test(key)) {
      store.walls.appendTypedLengthKey(key);

      return true;
    }

    if (key === 'Backspace') {
      if (isNil(store.walls.typedLengthText)) {
        store.walls.dropLastDraftWallPoint();
      } else {
        store.walls.setTypedLengthText(undefined);
      }

      return true;
    }

    return false;
  }

  onEscapeStep(): boolean {
    return false;
  }

  /**
   * The break UI of the selected wall junction (the
   * approved AutoCAD-style keys): while a junction is selected, a digit
   * removes that numbered edge, `D`+digit tears it off the junction and hands
   * its end to the pointer, `S` cuts the wall in two right here, Escape backs
   * out. These keys OUTRANK the tool hotkeys — the controller delegates here
   * first — or `s` and `d` would arm the stair and duct tools instead.
   */
  private onJunctionKey(key: string): boolean {
    const { store } = this.context;

    if (!isNil(this.detachCarry)) {
      if (key === 'Escape') {
        this.cancelDetach();

        return true;
      }

      return false;
    }

    const junction = store.walls.selectedJunction;

    if (isNil(junction)) {
      return false;
    }

    if (key === 'Escape') {
      store.walls.selectJunction(undefined);
      this.isDetachArmed = false;

      return true;
    }

    const lower = key.toLowerCase();

    if (lower === 'd') {
      this.isDetachArmed = true;

      return true;
    }

    if (lower === 's') {
      store.walls.splitWallAtJunction(this.buildingId);
      this.isDetachArmed = false;

      return true;
    }

    if (/^[1-9]$/.test(key)) {
      const edge = store.walls.selectedJunctionEdges[Number(key) - 1];

      if (!isNil(edge)) {
        if (this.isDetachArmed) {
          this.beginDetach(edge, junction);
        } else {
          store.walls.removeWallEdge(this.buildingId, edge.wallId, edge.segmentIndex);
        }
      }

      this.isDetachArmed = false;

      return true;
    }

    return false;
  }

  /** Tears the edge's end off the junction; the pointer carries it until a click plants it. */
  private beginDetach(edge: JunctionEdge, junction: Vector2): void {
    const { store } = this.context;
    const storey = this.activeStorey();
    const wall = storey?.walls.find(candidate => candidate.id === edge.wallId);

    if (isNil(storey) || isNil(wall)) {
      return;
    }

    const pointIndex = edgeJunctionVertexIndex(wall, edge.segmentIndex, junction);

    if (isNil(pointIndex)) {
      return;
    }

    const snapshot = storey.walls;

    store.pushHistory();
    this.detachCarry = {
      wallId: wall.id,
      pointIndex,
      restore: () => {
        for (const kept of snapshot) {
          store.walls.restoreWall(this.buildingId, kept);
        }
      },
    };
  }

  private plantDetachedVertex(planPoint: Vector2, modifiers: PlanModifiers): void {
    const carry = this.detachCarry;

    if (isNil(carry)) {
      return;
    }

    this.detachCarry = undefined;
    this.context.store.walls.moveWallPoint(
      this.buildingId,
      carry.wallId,
      carry.pointIndex,
      this.context.store.walls.clampWallPoint(
        this.buildingId,
        snapPointToGrid(this.context.store, planPoint, modifiers)
      )
    );
    this.context.store.walls.normalizeCrossings(this.buildingId);
  }

  private cancelDetach(): void {
    const carry = this.detachCarry;

    if (isNil(carry)) {
      return;
    }

    this.detachCarry = undefined;
    carry.restore();
  }

  hasTransientInteraction(): boolean {
    return (
      this.wallGestures.hasActive() ||
      this.objects.hasActive() ||
      this.slabs.hasActive() ||
      !isNil(this.detachCarry) ||
      !isNil(this.context.store.storeyObjects.pendingConnectDeviceId) ||
      this.context.store.walls.draftWallPoints.length > 0
    );
  }

  cancelTransients(): void {
    this.onPointerCancel();
    this.context.store.walls.cancelDraftWall();
    this.context.store.storeyObjects.setPendingConnectDeviceId(undefined);
  }

  /**
   * What the select tool takes hold of, nearest grip first: a drawn point of
   * the selected wall, then whichever wall's body lies under the pointer.
   */
  private beginSelectGesture(planPoint: Vector2, modifiers: PlanModifiers): void {
    if (
      this.beginSlabHandle(planPoint) ||
      this.beginStairRotation(planPoint) ||
      this.beginHeatingDrag(planPoint, modifiers) ||
      this.beginFurnitureRotation(planPoint) ||
      this.wallGestures.begin(planPoint, { allowInsert: true }) ||
      this.beginEntryDrag(planPoint, modifiers) ||
      this.beginDeviceDrag(planPoint, modifiers) ||
      this.beginOpeningDrag(planPoint, modifiers) ||
      this.beginSupportDrag(planPoint, modifiers) ||
      this.beginStairDrag(planPoint, modifiers) ||
      this.beginFurnitureDrag(planPoint, modifiers)
    ) {
      return;
    }

    const wall = this.pickWall(planPoint);

    if (isNil(wall)) {
      // The floor answers last: everything on a storey stands on it, so a slab
      // that answered first would swallow every click meant for empty floor.
      if (!this.beginSlabDrag(planPoint, modifiers)) {
        this.context.store.setSelection(undefined);
      }

      return;
    }

    this.context.store.setSelection({
      kind: 'wall',
      buildingId: this.buildingId,
      wallId: wall.id,
    });
  }

  /** With the opening tool in hand, a click hangs the armed preset on a wall. */
  private placeOpening(planPoint: Vector2): boolean {
    const wall = this.pickWall(planPoint);

    if (isNil(wall)) {
      return false;
    }

    const { offsetMeters } = projectOntoPolyline(wallCenterline(wall), planPoint);

    this.context.store.walls.addOpeningAt(this.buildingId, wall.id, offsetMeters);

    return true;
  }

  /**
   * An opening answers a click before the wall it pierces — the hosted thing
   * wins over its host, the way handles win over bodies. A grabbed opening is
   * recorded before the drag: one step to undo, expiring when no move follows.
   */
  private beginOpeningDrag(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { getViewport } = this.context;
    const storey = this.activeStorey();

    if (isNil(storey)) {
      return false;
    }

    const toleranceMeters = WALL_PICK_TOLERANCE_PX / getViewport().pixelsPerMeter;
    const walls = storey.walls;
    const openings = storey.openings;

    for (let index = openings.length - 1; index >= 0; index -= 1) {
      const opening = openings[index];
      const wall = walls.find(candidate => candidate.id === opening.wallId);

      if (isNil(wall)) {
        continue;
      }

      const projection = projectOntoPolyline(wallCenterline(wall), planPoint);
      const isOnOpening =
        Math.abs(projection.offsetMeters - opening.offsetMeters) <= opening.widthMeters / 2 &&
        projection.distanceMeters <= wall.thicknessMeters / 2 + toleranceMeters;

      if (isOnOpening) {
        this.select(
          { kind: 'opening', buildingId: this.buildingId, openingId: opening.id },
          modifiers
        );

        return this.objects.beginMove(this.draggedOpening(opening, wall), planPoint);
      }
    }

    return false;
  }

  /**
   * An opening does not roam: however the pointer moves, it slides ALONG its
   * host wall and keeps its whole width on it.
   */
  private draggedOpening(opening: Opening, wall: Wall): DraggedObject {
    const { store } = this.context;
    const centerline = wallCenterline(wall);

    return {
      origin: pointAlongPolyline(centerline, opening.offsetMeters) ?? { x: 0, y: 0 },
      moveTo: (draggedPoint, modifiers) => {
        const projection = projectOntoPolyline(centerline, draggedPoint);
        const halfWidth = opening.widthMeters / 2;
        const total = polylineLength(centerline);
        const snapped = snapAlong(store, projection.offsetMeters, modifiers);

        store.walls.moveOpening(
          this.buildingId,
          opening.id,
          clamp(snapped, halfWidth, Math.max(halfWidth, total - halfWidth))
        );
      },
      restore: () => store.walls.moveOpening(this.buildingId, opening.id, opening.offsetMeters),
    };
  }

  /** With the electric tool: wall kinds hang on a wall, a light goes on the ceiling. */
  private placeDevice(planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;
    const kind = store.storeyObjects.armedDeviceKind;

    if (kind === 'light') {
      store.storeyObjects.addCeilingLightAt(
        this.buildingId,
        snapPointToGrid(store, planPoint, modifiers)
      );

      return;
    }

    const wall = this.pickWall(planPoint);

    if (isNil(wall)) {
      return;
    }

    const { offsetMeters } = projectOntoPolyline(wallCenterline(wall), planPoint);

    store.storeyObjects.addWallDeviceAt(this.buildingId, kind, wall.id, offsetMeters);
  }

  /**
   * The connect tool: the first click takes a device, the second wires the
   * pair — panel to consumer, or switch to light — and lets go either way.
   */
  private pickForConnect(planPoint: Vector2): void {
    const { store } = this.context;
    const device = this.pickDevice(planPoint);

    if (isNil(device)) {
      store.storeyObjects.setPendingConnectDeviceId(undefined);

      return;
    }

    const pending = store.storeyObjects.pendingConnectDeviceId;

    if (isNil(pending)) {
      store.storeyObjects.setPendingConnectDeviceId(device.id);

      return;
    }

    store.storeyObjects.connectDevices(this.buildingId, pending, device.id);
    store.storeyObjects.setPendingConnectDeviceId(undefined);
  }

  /** The topmost device whose symbol area covers the point. */
  private pickDevice(planPoint: Vector2): ElectricalDevice | undefined {
    const { store, getViewport } = this.context;
    const storey = this.activeStorey();
    const scene = store.building.editedStoreyScene;

    if (isNil(storey) || isNil(scene)) {
      return undefined;
    }

    const pickRadiusMeters = DEVICE_PICK_RADIUS_PX / getViewport().pixelsPerMeter;
    const devices = devicesOf(storey);

    for (let index = devices.length - 1; index >= 0; index -= 1) {
      const device = devices[index];
      const symbol = scene.devices.find(candidate => candidate.id === device.id);

      if (
        !isNil(symbol) &&
        Math.hypot(symbol.position.x - planPoint.x, symbol.position.y - planPoint.y) <=
          pickRadiusMeters
      ) {
        return device;
      }
    }

    return undefined;
  }

  /**
   * Takes hold of a utility entry badge and selects it. The badge rides the
   * footprint outline, so the drag slides it there: the dragged point projects
   * back to an arc-length offset — the one number the entry actually is.
   */
  private beginEntryDrag(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store, getViewport } = this.context;
    const scene = store.scene.buildingScenes.find(
      candidate => candidate.building.id === this.buildingId
    );

    if (isNil(scene)) {
      return false;
    }

    const pickRadiusMeters = DEVICE_PICK_RADIUS_PX / getViewport().pixelsPerMeter;
    const picked = scene.entryPoints.find(
      entry =>
        Math.hypot(entry.position.x - planPoint.x, entry.position.y - planPoint.y) <=
        pickRadiusMeters
    );

    if (isNil(picked)) {
      return false;
    }

    const building = findBuildingIn(store.buildings, this.buildingId);
    const entry = isNil(building)
      ? undefined
      : entriesOf(building).find(candidate => candidate.id === picked.id);

    if (isNil(entry)) {
      return false;
    }

    this.select(
      { kind: 'utilityEntry', buildingId: this.buildingId, entryId: entry.id },
      modifiers
    );

    return this.objects.beginMove(
      {
        origin: picked.position,
        // The drag decides the placement: near the outline the badge rides it
        // (and gas may ride nothing else — СП 62); carried into the footprint
        // it becomes a sleeve through the slab, clamped to stay inside.
        moveTo: (draggedPoint, dragModifiers) => {
          const offset = offsetAlongOutline(scene.polygons, draggedPoint);

          if (isNil(offset)) {
            return;
          }

          const onOutline = pointOnOutline(scene.polygons, offset);
          const stickRadiusMeters =
            ENTRY_OUTLINE_STICK_RADIUS_PX / this.context.getViewport().pixelsPerMeter;
          const sticksToOutline =
            !canEnterThroughFloor(entry.system) ||
            isNil(onOutline) ||
            Math.hypot(draggedPoint.x - onOutline.x, draggedPoint.y - onOutline.y) <=
              stickRadiusMeters;

          if (sticksToOutline) {
            store.utilities.moveUtilityEntry(
              this.buildingId,
              entry.id,
              snapAlong(store, offset, dragModifiers)
            );
          } else {
            store.utilities.moveEntryToFloor(
              this.buildingId,
              entry.id,
              clampPointToMultiPolygon(
                scene.polygons,
                snapPointToGrid(store, draggedPoint, dragModifiers)
              )
            );
          }
        },
        restore: () =>
          isNil(entry.floorPosition)
            ? store.utilities.moveUtilityEntry(this.buildingId, entry.id, entry.outlineOffsetMeters)
            : store.utilities.moveEntryToFloor(this.buildingId, entry.id, entry.floorPosition),
      },
      planPoint
    );
  }

  /** Takes hold of the device under the pointer and selects it. */
  private beginDeviceDrag(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store } = this.context;
    const device = this.pickDevice(planPoint);

    if (isNil(device)) {
      return false;
    }

    const storey = this.activeStorey();
    const wall =
      device.host.kind === 'wall' && !isNil(storey)
        ? storey.walls.find(candidate =>
            device.host.kind === 'wall' ? candidate.id === device.host.wallId : false
          )
        : undefined;
    const scene = store.building.editedStoreyScene;
    const symbol = scene?.devices.find(candidate => candidate.id === device.id);

    this.select({ kind: 'device', buildingId: this.buildingId, deviceId: device.id }, modifiers);

    return this.objects.beginMove(
      this.draggedDevice(device, wall, symbol?.position ?? planPoint),
      planPoint
    );
  }

  /** A wall device slides along its host; a ceiling light roams the grid. */
  private draggedDevice(
    device: ElectricalDevice,
    wall: Wall | undefined,
    origin: Vector2
  ): DraggedObject {
    const { store } = this.context;

    return {
      origin,
      moveTo: (draggedPoint, modifiers) => {
        if (device.host.kind === 'wall' && !isNil(wall)) {
          const centerline = wallCenterline(wall);
          const projection = projectOntoPolyline(centerline, draggedPoint);

          store.storeyObjects.moveDevice(this.buildingId, device.id, {
            host: {
              ...device.host,
              offsetMeters: clamp(
                snapAlong(store, projection.offsetMeters, modifiers),
                0,
                polylineLength(centerline)
              ),
            },
          });

          return;
        }

        if (device.host.kind === 'ceiling') {
          store.storeyObjects.moveDevice(this.buildingId, device.id, {
            host: {
              kind: 'ceiling',
              position: snapPointToGrid(store, draggedPoint, modifiers),
            },
          });
        }
      },
      restore: () =>
        store.storeyObjects.moveDevice(this.buildingId, device.id, { host: device.host }),
    };
  }

  /**
   * The grip ahead of the selected piece turns it, the way a car's does. Like
   * every handle it wins over whatever lies beneath it.
   */
  private beginFurnitureRotation(planPoint: Vector2): boolean {
    const { store, getViewport } = this.context;
    const furniture = store.storeyObjects.selectedFurniture;

    if (isNil(furniture)) {
      return false;
    }

    const viewport = getViewport();
    const handle = findHandleAt(
      computeFurnitureHandles(furniture, viewport),
      planToScreen(viewport, planPoint)
    );

    if (isNil(handle)) {
      return false;
    }

    return this.objects.beginRotate(this.draggedFurniture(furniture), planPoint);
  }

  /** Takes hold of the piece under the pointer, topmost first, and selects it. */
  /**
   * Selects, or — with Shift — adds to what is already selected. One helper so
   * every body in this editor answers the modifier the same way.
   */
  private select(selection: Selection, modifiers: PlanModifiers): void {
    const { store } = this.context;

    if (modifiers.isShiftPressed) {
      store.toggleSelection(selection);

      return;
    }

    store.setSelection(selection);
  }

  /** The grips of the selected slab: turn, and the eight that resize it. */
  private beginSlabHandle(planPoint: Vector2): boolean {
    const slab = this.selectedSlab();

    return !isNil(slab) && this.slabs.beginHandle(slab, undefined, planPoint);
  }

  /** Takes hold of the slab under the pointer — the floor itself, dragged whole. */
  private beginSlabDrag(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store, getViewport } = this.context;
    const slabs = store.storeyObjects.activeStoreySlabs;
    const toleranceMeters = WALL_PICK_TOLERANCE_PX / getViewport().pixelsPerMeter;

    for (let index = slabs.length - 1; index >= 0; index -= 1) {
      const slab = slabs[index];

      if (!hitTestShape(slab, planPoint, toleranceMeters)) {
        continue;
      }

      this.select({ kind: 'slab', buildingId: this.buildingId, slabId: slab.id }, modifiers);
      this.slabs.beginMove(slab, undefined, planPoint);

      return true;
    }

    return false;
  }

  /** The slab the selection names, resolved against the active storey. */
  private selectedSlab(): Slab | undefined {
    const { store } = this.context;
    const selection = store.selection;

    return selection?.kind === 'slab'
      ? store.storeyObjects.activeStoreySlabs.find(candidate => candidate.id === selection.slabId)
      : undefined;
  }

  /**
   * Takes hold of a fireplace or a shaft. Both are small and both are drawn
   * over whatever room they stand in, so they answer before the walls do; a
   * shaft only answers on the storey it STARTS on — the section of it crossing
   * an upper floor is a hole, not a handle.
   */
  private beginHeatingDrag(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store, getViewport } = this.context;
    const scene = store.building.editedStoreyScene;

    if (isNil(scene)) {
      return false;
    }

    const toleranceMeters = HANDLE_HIT_RADIUS_PX / getViewport().pixelsPerMeter;

    for (const section of scene.ducts) {
      if (!section.startsHere || !isPointOnStair([section.footprint], planPoint, toleranceMeters)) {
        continue;
      }

      // A flue belongs to its fireplace: grabbing it grabs the fireplace.
      const owner = scene.fireplaces.find(
        candidate => candidate.fireplace.id === section.fireplaceId
      );

      if (!isNil(owner)) {
        return this.grabFireplace(owner.fireplace, planPoint, modifiers);
      }

      this.select(
        { kind: 'duct', buildingId: this.buildingId, ductId: section.duct.id },
        modifiers
      );

      return this.objects.beginMove(this.draggedDuct(section.duct), planPoint);
    }

    for (const fireplaceScene of scene.fireplaces) {
      if (hitTestRotatedBox(fireplaceBox(fireplaceScene.fireplace), planPoint, toleranceMeters)) {
        return this.grabFireplace(fireplaceScene.fireplace, planPoint, modifiers);
      }
    }

    return false;
  }

  private grabFireplace(
    fireplace: Fireplace,
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): boolean {
    this.select(
      { kind: 'fireplace', buildingId: this.buildingId, fireplaceId: fireplace.id },
      modifiers
    );

    return this.objects.beginMove(this.draggedFireplace(fireplace), planPoint);
  }

  /** A fireplace slides and turns; its flue follows, because the flue derives. */
  private draggedFireplace(fireplace: Fireplace): DraggedObject {
    const { store } = this.context;

    return {
      origin: fireplace.position,
      moveTo: (draggedPoint, modifiers) =>
        store.storeyObjects.moveFireplace(this.buildingId, fireplace.id, {
          position: snapPointToGrid(store, draggedPoint, modifiers),
        }),
      turnTo: rotationDegrees =>
        store.storeyObjects.moveFireplace(this.buildingId, fireplace.id, { rotationDegrees }),
      restore: () =>
        store.storeyObjects.moveFireplace(this.buildingId, fireplace.id, {
          position: fireplace.position,
          rotationDegrees: fireplace.rotationDegrees,
        }),
    };
  }

  /** A shaft only ever slides: it has no facing to turn. */
  private draggedDuct(duct: VerticalDuct): DraggedObject {
    const { store } = this.context;

    return {
      origin: duct.position,
      moveTo: (draggedPoint, modifiers) =>
        store.storeyObjects.moveDuct(this.buildingId, duct.id, {
          position: snapPointToGrid(store, draggedPoint, modifiers),
        }),
      restore: () =>
        store.storeyObjects.moveDuct(this.buildingId, duct.id, { position: duct.position }),
    };
  }

  /** Takes hold of a post: a small target, so it is picked before the stairs. */
  private beginSupportDrag(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store, getViewport } = this.context;
    const scene = store.building.editedStoreyScene;

    if (isNil(scene)) {
      return false;
    }

    const toleranceMeters = HANDLE_HIT_RADIUS_PX / getViewport().pixelsPerMeter;

    for (let index = scene.supports.length - 1; index >= 0; index -= 1) {
      const supportScene = scene.supports[index];

      if (!isPointOnStair([supportScene.footprint], planPoint, toleranceMeters)) {
        continue;
      }

      this.select(
        { kind: 'support', buildingId: this.buildingId, supportId: supportScene.post.id },
        modifiers
      );

      return this.objects.beginMove(this.draggedSupport(supportScene.post), planPoint);
    }

    return false;
  }

  /** Takes hold of a stair's body: the same grab as a sofa's. */
  private beginStairDrag(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store, getViewport } = this.context;
    const scene = store.building.editedStoreyScene;

    if (isNil(scene)) {
      return false;
    }

    const toleranceMeters = WALL_PICK_TOLERANCE_PX / getViewport().pixelsPerMeter;

    for (let index = scene.stairs.length - 1; index >= 0; index -= 1) {
      const stairScene = scene.stairs[index];

      if (!isPointOnStair(stairScene.footprint, planPoint, toleranceMeters)) {
        continue;
      }

      this.select(
        { kind: 'stair', buildingId: this.buildingId, stairId: stairScene.stair.id },
        modifiers
      );

      return this.objects.beginMove(this.draggedStair(stairScene.stair), planPoint);
    }

    return false;
  }

  /** The turn grip of the selected stair — furniture's grip, same distance. */
  private beginStairRotation(planPoint: Vector2): boolean {
    const { store, getViewport } = this.context;
    const selection = store.selection;
    const scene = store.building.editedStoreyScene;

    if (selection?.kind !== 'stair' || isNil(scene)) {
      return false;
    }

    const stairScene = scene.stairs.find(candidate => candidate.stair.id === selection.stairId);

    if (isNil(stairScene)) {
      return false;
    }

    const { rotationGrip } = stairScene;
    const toleranceMeters = HANDLE_HIT_RADIUS_PX / getViewport().pixelsPerMeter;

    if (Math.hypot(planPoint.x - rotationGrip.x, planPoint.y - rotationGrip.y) > toleranceMeters) {
      return false;
    }

    return this.objects.beginRotate(this.draggedStair(stairScene.stair), planPoint);
  }

  /** A post only ever slides: it has no facing to turn and no hand to mirror. */
  private draggedSupport(post: SupportPost): DraggedObject {
    const { store } = this.context;

    return {
      origin: post.position,
      moveTo: (draggedPoint, modifiers) =>
        store.storeyObjects.moveSupport(this.buildingId, post.id, {
          position: snapPointToGrid(store, draggedPoint, modifiers),
        }),
      restore: () =>
        store.storeyObjects.moveSupport(this.buildingId, post.id, { position: post.position }),
    };
  }

  /** A stair is an object like any other (R26): it moves and it turns. */
  private draggedStair(stair: StairInstance): DraggedObject {
    const { store } = this.context;

    return {
      origin: stair.position,
      startRotationDegrees: stair.rotationDegrees,
      moveTo: (draggedPoint, modifiers) =>
        store.storeyObjects.moveStair(this.buildingId, stair.id, {
          position: snapPointToGrid(store, draggedPoint, modifiers),
        }),
      turnTo: rotationDegrees =>
        store.storeyObjects.moveStair(this.buildingId, stair.id, { rotationDegrees }),
      restore: () =>
        store.storeyObjects.moveStair(this.buildingId, stair.id, {
          position: stair.position,
          rotationDegrees: stair.rotationDegrees,
        }),
    };
  }

  private beginFurnitureDrag(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { getViewport } = this.context;
    const storey = this.activeStorey();

    if (isNil(storey)) {
      return false;
    }

    const toleranceMeters = WALL_PICK_TOLERANCE_PX / getViewport().pixelsPerMeter;
    const furniture = furnitureOf(storey);

    for (let index = furniture.length - 1; index >= 0; index -= 1) {
      const item = furniture[index];
      const box = furnitureBox(item);

      if (!isNil(box) && hitTestRotatedBox(box, planPoint, toleranceMeters)) {
        this.select(
          { kind: 'furniture', buildingId: this.buildingId, furnitureId: item.id },
          modifiers
        );

        return this.objects.beginMove(this.draggedFurniture(item), planPoint);
      }
    }

    return false;
  }

  /**
   * Moving snaps to the grid until a wall catches the piece — the Sweet Home
   * 3D magnet turns its back flush against the face; Alt suspends both.
   * Turning snaps the heading the way every other turn on the plan does.
   */
  private draggedFurniture(item: FurnitureInstance): DraggedObject {
    const { store } = this.context;

    return {
      origin: item.position,
      startRotationDegrees: item.rotationDegrees,
      moveTo: (draggedPoint, modifiers) => {
        const storey = this.activeStorey();
        const entry = findFurnitureEntry(item.catalogId);
        const magnetized =
          modifiers.isAltPressed || isNil(storey) || isNil(entry)
            ? undefined
            : magnetizeFurnitureToWall({
                position: draggedPoint,
                depthMeters: entry.depthMeters,
                walls: storey.walls,
                thresholdMeters: FURNITURE_MAGNET_RADIUS_METERS,
              });

        store.storeyObjects.moveFurniture(
          this.buildingId,
          item.id,
          isNil(magnetized)
            ? {
                position: snapPointToGrid(store, draggedPoint, modifiers),
                rotationDegrees: item.rotationDegrees,
              }
            : {
                position: magnetized.position,
                rotationDegrees: normalizeTurnDegrees(magnetized.rotationDegrees),
              }
        );
      },
      turnTo: rotationDegrees =>
        store.storeyObjects.moveFurniture(this.buildingId, item.id, { rotationDegrees }),
      restore: () =>
        store.storeyObjects.moveFurniture(this.buildingId, item.id, {
          position: item.position,
          rotationDegrees: item.rotationDegrees,
        }),
    };
  }

  /** The storey the editor is aimed at — the only one the canvas offers. */
  private activeStorey(): Storey | undefined {
    const { store } = this.context;
    const building = store.buildings.find(candidate => candidate.id === this.buildingId);

    if (isNil(building)) {
      return undefined;
    }

    const storeys = storeysOf(building);

    return storeys.find(storey => storey.id === store.building.activeStoreyId) ?? storeys[0];
  }

  /** The topmost wall whose body covers the point; later walls lie over earlier. */
  private pickWall(planPoint: Vector2): Wall | undefined {
    const { getViewport } = this.context;
    const storey = this.activeStorey();

    if (isNil(storey)) {
      return undefined;
    }

    const toleranceMeters = WALL_PICK_TOLERANCE_PX / getViewport().pixelsPerMeter;
    const walls = storey.walls;

    for (let index = walls.length - 1; index >= 0; index -= 1) {
      const wall = walls[index];

      if (
        distanceToPolyline(wallCenterline(wall), planPoint) <=
        wall.thicknessMeters / 2 + toleranceMeters
      ) {
        return wall;
      }
    }

    return undefined;
  }
}

/** The body of a fireplace as a box, for picking it off the plan. */
function fireplaceBox(fireplace: Fireplace): RotatedBox {
  const spec = FIREPLACE_SPECS[fireplace.kind];

  return {
    center: fireplace.position,
    rotationDegrees: fireplace.rotationDegrees,
    extentX: spec.widthMeters,
    extentY: spec.depthMeters,
  };
}

/** Snapping ALONG a wall: the same grid step, applied to one dimension. */
function snapAlong(
  store: SitePlannerStore,
  offsetMeters: Meters,
  modifiers: PlanModifiers
): Meters {
  const step = gridStep(store, modifiers);

  return step > 0 ? Math.round(offsetMeters / step) * step : offsetMeters;
}
