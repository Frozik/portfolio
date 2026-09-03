import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp, isNil } from 'lodash-es';
import { TYPED_LENGTH_KEY_PATTERN } from '../../domain/geometry/draw-constraints';
import { magnetizeFurnitureToWall } from '../../domain/geometry/furniture-magnetism';
import { distanceToPolyline } from '../../domain/geometry/hit-test-objects';
import type { RotatedBox } from '../../domain/geometry/hit-test-shape';
import { hitTestRotatedBox, hitTestShape } from '../../domain/geometry/hit-test-shape';
import { isPointOnStair } from '../../domain/geometry/stair-footprint';

import {
  pointAlongPolyline,
  polylineLength,
  projectOntoPolyline,
  wallCenterline,
} from '../../domain/geometry/wall-geometry';
import type { VerticalDuct } from '../../domain/model/ducts';
import type { ElectricalDevice } from '../../domain/model/electrical';
import type { Fireplace } from '../../domain/model/fireplaces';
import { FIREPLACE_SPECS } from '../../domain/model/fireplaces';
import type { FurnitureInstance } from '../../domain/model/furniture';
import { findFurnitureEntry, furnitureBox } from '../../domain/model/furniture';
import type { Opening } from '../../domain/model/openings';
import type { Selection } from '../../domain/model/selection';
import type { BuildingId } from '../../domain/model/site-plan';
import { storeysOf } from '../../domain/model/site-plan';
import type { Slab } from '../../domain/model/slabs';
import type { StairInstance } from '../../domain/model/stairs';
import type { Storey } from '../../domain/model/storeys';
import { devicesOf, furnitureOf } from '../../domain/model/storeys';
import type { SupportPost } from '../../domain/model/supports';
import type { Wall } from '../../domain/model/walls';
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

/**
 * The building editor's canvas behaviour (`building-editor.md` §4, stage 2):
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

  constructor(context: InteractionContext, buildingId: BuildingId) {
    this.context = context;
    this.buildingId = buildingId;
    this.wallGestures = new WallPointGestures(context, buildingId);
    this.objects = new ObjectDragGestures(context);
    // Everything on a storey is drawn against walls that are already standing,
    // so the object snap is live without a modifier here — the OSNAP habit the
    // wall tool already follows (`building-editor.md` §2). A slab is caught by
    // the corners and side middles of the storey BELOW as well as by its own
    // storey's, which is what makes «flush with the room downstairs» a gesture
    // rather than four typed numbers.
    this.slabs = new ShapeGestures<void>(context, {
      isSnapAlwaysLive: true,
      update: slab => context.store.updateSlab(buildingId, slab),
      add: slab => {
        context.store.addSlab(slab);
        context.store.finishPlacement();
      },
      snapPoints: excludedShapeId => context.store.slabSnapPoints(excludedShapeId),
    });
  }

  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store } = this.context;

    switch (store.activeTool) {
      case 'select':
        this.beginSelectGesture(planPoint, modifiers);

        return true;
      case 'building:wall':
        // The ground storey stands on the foundation, so a click past the
        // slab lands on its edge; an upper storey may overhang (R24).
        // `draftWallCursor` is the previewed corner — angle lock and typed
        // length included — so what the rubber band showed is what lands.
        store.appendDraftWallPoint(
          store.clampWallPoint(
            this.buildingId,
            store.draftWallCursor ?? snapPointToGrid(store, planPoint, modifiers)
          )
        );
        store.setTypedLengthText(undefined);

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
        store.placeFireplaceAt(snapPointToGrid(store, planPoint, modifiers));
        store.finishPlacement();

        return true;
      case 'building:duct':
        store.placeDuctAt(snapPointToGrid(store, planPoint, modifiers));
        store.finishPlacement();

        return true;
      case 'building:support':
        // A post is placed like a socket: one click, both ends derived.
        store.placeSupportAt(snapPointToGrid(store, planPoint, modifiers));
        store.finishPlacement();

        return true;
      case 'building:stair':
        // A stair is placed, not drawn: its run comes from the storey height,
        // so the click only says where. Snapping keeps it off half-metres.
        store.placeStairAt(snapPointToGrid(store, planPoint, modifiers));
        store.finishPlacement();

        return true;
      // Furniture and electrics are STICKY: a room is furnished and a storey
      // wired by placing one piece after another, so these two tools stay in
      // hand. The piece that lands is still selected, so its properties are
      // there to type — only the tool is not taken away.
      case 'building:furniture':
        store.placeFurnitureAt(this.buildingId, snapPointToGrid(store, planPoint, modifiers));

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
    if (this.objects.move(planPoint, modifiers) || this.slabs.move(planPoint, modifiers)) {
      return true;
    }

    if (this.wallGestures.move(planPoint, modifiers)) {
      return true;
    }

    // With the select tool idle over the selected wall, the handles announce
    // themselves — and the event is spent, or the shell would clear the hover.
    if (this.context.store.activeTool === 'select' && !isNil(this.context.store.selectedWall)) {
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
        this.context.store.placeSlabAt(snapPointToGrid(this.context.store, planPoint, modifiers));
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
    const wall = store.selectedWall;

    if (isNil(wall) || isWallClosed(wall) || wall.points.length < MIN_CLOSED_WALL_POINTS + 1) {
      return;
    }

    const [first] = wall.points;
    const last = wall.points[wall.points.length - 1];

    if (first.x === last.x && first.y === last.y) {
      store.closeWallRing(this.buildingId, wall.id);
    }
  }

  onPointerCancel(): void {
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

    if (store.draftWallPoints.length > 0) {
      store.commitDraftWall();

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
    const wall = store.selectedWall;

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
      store.cutWallAtPoint(this.buildingId, wall.id, handle.index);
    } else {
      store.removeWallPoint(this.buildingId, wall.id, handle.index);
    }

    // The gone point's highlight would light its successor by index.
    store.setPathHandleHighlight(undefined);

    return true;
  }

  onKeyDown(key: string, _modifiers: PlanModifiers): boolean {
    const { store } = this.context;

    if (key === 'Enter' && store.draftWallPoints.length > 0) {
      store.commitDraftWall();

      return true;
    }

    if (store.draftWallPoints.length === 0) {
      return false;
    }

    // The CAD value-control box: aim roughly, then state the length. Digits
    // and one separator accumulate; Backspace peels the number back and, once
    // it is empty, takes the last corner with it.
    if (TYPED_LENGTH_KEY_PATTERN.test(key)) {
      store.appendTypedLengthKey(key);

      return true;
    }

    if (key === 'Backspace') {
      if (isNil(store.typedLengthText)) {
        store.dropLastDraftWallPoint();
      } else {
        store.setTypedLengthText(undefined);
      }

      return true;
    }

    return false;
  }

  onEscapeStep(): boolean {
    return false;
  }

  hasTransientInteraction(): boolean {
    return (
      this.wallGestures.hasActive() ||
      this.objects.hasActive() ||
      this.slabs.hasActive() ||
      !isNil(this.context.store.pendingConnectDeviceId) ||
      this.context.store.draftWallPoints.length > 0
    );
  }

  cancelTransients(): void {
    this.onPointerCancel();
    this.context.store.cancelDraftWall();
    this.context.store.setPendingConnectDeviceId(undefined);
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

    this.context.store.addOpeningAt(this.buildingId, wall.id, offsetMeters);

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

        store.moveOpening(
          this.buildingId,
          opening.id,
          clamp(snapped, halfWidth, Math.max(halfWidth, total - halfWidth))
        );
      },
      restore: () => store.moveOpening(this.buildingId, opening.id, opening.offsetMeters),
    };
  }

  /** With the electric tool: wall kinds hang on a wall, a light goes on the ceiling. */
  private placeDevice(planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;
    const kind = store.armedDeviceKind;

    if (kind === 'light') {
      store.addCeilingLightAt(this.buildingId, snapPointToGrid(store, planPoint, modifiers));

      return;
    }

    const wall = this.pickWall(planPoint);

    if (isNil(wall)) {
      return;
    }

    const { offsetMeters } = projectOntoPolyline(wallCenterline(wall), planPoint);

    store.addWallDeviceAt(this.buildingId, kind, wall.id, offsetMeters);
  }

  /**
   * The connect tool: the first click takes a device, the second wires the
   * pair — panel to consumer, or switch to light — and lets go either way.
   */
  private pickForConnect(planPoint: Vector2): void {
    const { store } = this.context;
    const device = this.pickDevice(planPoint);

    if (isNil(device)) {
      store.setPendingConnectDeviceId(undefined);

      return;
    }

    const pending = store.pendingConnectDeviceId;

    if (isNil(pending)) {
      store.setPendingConnectDeviceId(device.id);

      return;
    }

    store.connectDevices(this.buildingId, pending, device.id);
    store.setPendingConnectDeviceId(undefined);
  }

  /** The topmost device whose symbol area covers the point. */
  private pickDevice(planPoint: Vector2): ElectricalDevice | undefined {
    const { store, getViewport } = this.context;
    const storey = this.activeStorey();
    const scene = store.editedStoreyScene;

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
    const scene = store.editedStoreyScene;
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

          store.moveDevice(this.buildingId, device.id, {
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
          store.moveDevice(this.buildingId, device.id, {
            host: {
              kind: 'ceiling',
              position: snapPointToGrid(store, draggedPoint, modifiers),
            },
          });
        }
      },
      restore: () => store.moveDevice(this.buildingId, device.id, { host: device.host }),
    };
  }

  /**
   * The grip ahead of the selected piece turns it, the way a car's does. Like
   * every handle it wins over whatever lies beneath it.
   */
  private beginFurnitureRotation(planPoint: Vector2): boolean {
    const { store, getViewport } = this.context;
    const furniture = store.selectedFurniture;

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

    return this.objects.beginRotate(this.draggedFurniture(furniture));
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
    const slabs = store.activeStoreySlabs;
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
      ? store.activeStoreySlabs.find(candidate => candidate.id === selection.slabId)
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
    const scene = store.editedStoreyScene;

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
        store.moveFireplace(this.buildingId, fireplace.id, {
          position: snapPointToGrid(store, draggedPoint, modifiers),
        }),
      turnTo: rotationDegrees =>
        store.moveFireplace(this.buildingId, fireplace.id, { rotationDegrees }),
      restore: () =>
        store.moveFireplace(this.buildingId, fireplace.id, {
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
        store.moveDuct(this.buildingId, duct.id, {
          position: snapPointToGrid(store, draggedPoint, modifiers),
        }),
      restore: () => store.moveDuct(this.buildingId, duct.id, { position: duct.position }),
    };
  }

  /** Takes hold of a post: a small target, so it is picked before the stairs. */
  private beginSupportDrag(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store, getViewport } = this.context;
    const scene = store.editedStoreyScene;

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
    const scene = store.editedStoreyScene;

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
    const scene = store.editedStoreyScene;

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

    return this.objects.beginRotate(this.draggedStair(stairScene.stair));
  }

  /** A post only ever slides: it has no facing to turn and no hand to mirror. */
  private draggedSupport(post: SupportPost): DraggedObject {
    const { store } = this.context;

    return {
      origin: post.position,
      moveTo: (draggedPoint, modifiers) =>
        store.moveSupport(this.buildingId, post.id, {
          position: snapPointToGrid(store, draggedPoint, modifiers),
        }),
      restore: () => store.moveSupport(this.buildingId, post.id, { position: post.position }),
    };
  }

  /** A stair is an object like any other (R26): it moves and it turns. */
  private draggedStair(stair: StairInstance): DraggedObject {
    const { store } = this.context;

    return {
      origin: stair.position,
      moveTo: (draggedPoint, modifiers) =>
        store.moveStair(this.buildingId, stair.id, {
          position: snapPointToGrid(store, draggedPoint, modifiers),
        }),
      turnTo: rotationDegrees => store.moveStair(this.buildingId, stair.id, { rotationDegrees }),
      restore: () =>
        store.moveStair(this.buildingId, stair.id, {
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

        store.moveFurniture(
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
      turnTo: rotationDegrees => store.moveFurniture(this.buildingId, item.id, { rotationDegrees }),
      restore: () =>
        store.moveFurniture(this.buildingId, item.id, {
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

    return storeys.find(storey => storey.id === store.activeStoreyId) ?? storeys[0];
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
