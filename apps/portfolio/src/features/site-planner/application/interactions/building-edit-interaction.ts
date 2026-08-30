import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { magnetizeFurnitureToWall } from '../../domain/geometry/furniture-magnetism';
import { distanceToPolyline } from '../../domain/geometry/hit-test-objects';
import { hitTestRotatedBox } from '../../domain/geometry/hit-test-shape';
import { bearingDegreesTowards } from '../../domain/geometry/transform-shape';
import {
  polylineLength,
  projectOntoPolyline,
  wallCenterline,
} from '../../domain/geometry/wall-geometry';
import type { ElectricalDevice } from '../../domain/model/electrical';
import type { FurnitureInstance } from '../../domain/model/furniture';
import { findFurnitureEntry, furnitureBox } from '../../domain/model/furniture';
import type { Opening } from '../../domain/model/openings';
import type { BuildingId } from '../../domain/model/site-plan';
import { storeysOf } from '../../domain/model/site-plan';
import type { Storey } from '../../domain/model/storeys';
import { devicesOf, furnitureOf } from '../../domain/model/storeys';
import type { Wall } from '../../domain/model/walls';
import { isWallClosed, MIN_CLOSED_WALL_POINTS } from '../../domain/model/walls';
import { computeFurnitureHandles } from '../../domain/plan-draw/draw-furniture';
import {
  computePolylinePointHandles,
  findPathPointHandleAt,
} from '../../domain/plan-draw/draw-paths';
import { normalizeTurnDegrees } from '../../domain/units';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { rotationStepDegrees, snapLength } from '../../domain/view/snapping';
import type { EditorInteraction, InteractionContext } from './editor-interaction';
import { gridStep, offsetBetween, snapPointToGrid } from './grid-snapping';
import { findHandleAt, HANDLE_HIT_RADIUS_PX } from './plan-picking';
import { applyWallHandleHover, WallPointGestures } from './wall-point-gestures';

/** How far outside its body a wall still answers a click, in pixels. */
const WALL_PICK_TOLERANCE_PX = 6;
/** How near a wall face pulls a dragged piece flush against it, in metres. */
const FURNITURE_MAGNET_RADIUS_METERS = 0.5;
/** The grab radius around a device symbol, generous around the drawn glyph. */
const DEVICE_PICK_RADIUS_PX = 10;

/**
 * Sliding an opening along its host wall — a 1-D drag: however the pointer
 * roams, the opening only ever moves along the wall's centreline.
 */
interface OpeningDrag {
  readonly startOpening: Opening;
  readonly wall: Wall;
}

/** Sliding a wall device along its host, or a ceiling light across the plan. */
interface DeviceDrag {
  readonly startDevice: ElectricalDevice;
  readonly wall: Wall | undefined;
  readonly grabOffset: Vector2;
}

/** Moving or turning a piece of furniture; which of the two the grip decides. */
interface FurnitureDrag {
  readonly kind: 'move' | 'rotate';
  readonly startFurniture: FurnitureInstance;
  readonly grabOffset: Vector2;
}

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
  private openingDrag: OpeningDrag | undefined = undefined;
  private furnitureDrag: FurnitureDrag | undefined = undefined;
  private deviceDrag: DeviceDrag | undefined = undefined;

  constructor(context: InteractionContext, buildingId: BuildingId) {
    this.context = context;
    this.buildingId = buildingId;
    this.wallGestures = new WallPointGestures(context, buildingId);
  }

  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store } = this.context;

    switch (store.activeTool) {
      case 'select':
        this.beginSelectGesture(planPoint);

        return true;
      case 'building:wall':
        // Walls stand on the foundation: a click past the slab lands on its edge.
        store.appendDraftWallPoint(
          store.clampToFoundation(this.buildingId, snapPointToGrid(store, planPoint, modifiers))
        );

        return true;
      case 'building:opening':
        this.placeOpening(planPoint);

        return true;
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
    const deviceDrag = this.deviceDrag;

    if (!isNil(deviceDrag)) {
      this.dragDeviceTo(deviceDrag, planPoint, modifiers);

      return true;
    }

    const furnitureDrag = this.furnitureDrag;

    if (!isNil(furnitureDrag)) {
      this.dragFurnitureTo(furnitureDrag, planPoint, modifiers);

      return true;
    }

    const openingDrag = this.openingDrag;

    if (!isNil(openingDrag)) {
      this.slideOpening(openingDrag, planPoint, modifiers);

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
    const deviceDrag = this.deviceDrag;

    if (!isNil(deviceDrag)) {
      this.deviceDrag = undefined;

      if (this.context.hasPointerMoved()) {
        this.dragDeviceTo(deviceDrag, planPoint, modifiers);
      }

      return true;
    }

    const furnitureDrag = this.furnitureDrag;

    if (!isNil(furnitureDrag)) {
      this.furnitureDrag = undefined;

      if (this.context.hasPointerMoved()) {
        this.dragFurnitureTo(furnitureDrag, planPoint, modifiers);
      }

      return true;
    }

    const openingDrag = this.openingDrag;

    if (!isNil(openingDrag)) {
      this.openingDrag = undefined;

      if (this.context.hasPointerMoved()) {
        this.slideOpening(openingDrag, planPoint, modifiers);
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
    const deviceDrag = this.deviceDrag;

    if (!isNil(deviceDrag)) {
      this.deviceDrag = undefined;

      if (this.context.hasPointerMoved()) {
        this.context.store.moveDevice(this.buildingId, deviceDrag.startDevice.id, {
          host: deviceDrag.startDevice.host,
        });
      }
    }

    const furnitureDrag = this.furnitureDrag;

    if (!isNil(furnitureDrag)) {
      this.furnitureDrag = undefined;

      if (this.context.hasPointerMoved()) {
        this.context.store.moveFurniture(this.buildingId, furnitureDrag.startFurniture.id, {
          position: furnitureDrag.startFurniture.position,
          rotationDegrees: furnitureDrag.startFurniture.rotationDegrees,
        });
      }
    }

    const openingDrag = this.openingDrag;

    if (!isNil(openingDrag)) {
      this.openingDrag = undefined;

      if (this.context.hasPointerMoved()) {
        this.context.store.moveOpening(
          this.buildingId,
          openingDrag.startOpening.id,
          openingDrag.startOpening.offsetMeters
        );
      }
    }

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
    if (key === 'Enter' && this.context.store.draftWallPoints.length > 0) {
      this.context.store.commitDraftWall();

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
      !isNil(this.openingDrag) ||
      !isNil(this.furnitureDrag) ||
      !isNil(this.deviceDrag) ||
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
  private beginSelectGesture(planPoint: Vector2): void {
    if (
      this.beginFurnitureRotation(planPoint) ||
      this.wallGestures.begin(planPoint, { allowInsert: true }) ||
      this.beginDeviceDrag(planPoint) ||
      this.beginOpeningDrag(planPoint) ||
      this.beginFurnitureDrag(planPoint)
    ) {
      return;
    }

    const wall = this.pickWall(planPoint);

    if (isNil(wall)) {
      this.context.store.setSelection(undefined);

      return;
    }

    this.context.store.setSelection({
      kind: 'wall',
      buildingId: this.buildingId,
      wallId: wall.id,
    });
  }

  /** With the opening tool in hand, a click hangs the armed preset on a wall. */
  private placeOpening(planPoint: Vector2): void {
    const wall = this.pickWall(planPoint);

    if (isNil(wall)) {
      return;
    }

    const { offsetMeters } = projectOntoPolyline(wallCenterline(wall), planPoint);

    this.context.store.addOpeningAt(this.buildingId, wall.id, offsetMeters);
  }

  /**
   * An opening answers a click before the wall it pierces — the hosted thing
   * wins over its host, the way handles win over bodies. A grabbed opening is
   * recorded before the drag: one step to undo, expiring when no move follows.
   */
  private beginOpeningDrag(planPoint: Vector2): boolean {
    const { store, getViewport } = this.context;
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
        store.setSelection({ kind: 'opening', buildingId: this.buildingId, openingId: opening.id });
        store.pushHistory();
        this.openingDrag = { startOpening: opening, wall };

        return true;
      }
    }

    return false;
  }

  /** The 1-D slide: project, snap along the wall, and keep the whole width on it. */
  private slideOpening(drag: OpeningDrag, planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;
    const centerline = wallCenterline(drag.wall);
    const projection = projectOntoPolyline(centerline, planPoint);
    const step = gridStep(store, modifiers);
    const snapped =
      step > 0 ? Math.round(projection.offsetMeters / step) * step : projection.offsetMeters;
    const halfWidth = drag.startOpening.widthMeters / 2;
    const total = polylineLength(centerline);
    const clamped = Math.max(halfWidth, Math.min(snapped, Math.max(halfWidth, total - halfWidth)));

    store.moveOpening(this.buildingId, drag.startOpening.id, clamped);
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
  private beginDeviceDrag(planPoint: Vector2): boolean {
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

    store.setSelection({ kind: 'device', buildingId: this.buildingId, deviceId: device.id });
    store.pushHistory();
    this.deviceDrag = {
      startDevice: device,
      wall,
      grabOffset: isNil(symbol) ? { x: 0, y: 0 } : offsetBetween(planPoint, symbol.position),
    };

    return true;
  }

  /** A wall device slides along its host; a ceiling light roams the grid. */
  private dragDeviceTo(drag: DeviceDrag, planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;
    const { startDevice, wall } = drag;

    if (startDevice.host.kind === 'wall' && !isNil(wall)) {
      const centerline = wallCenterline(wall);
      const projection = projectOntoPolyline(centerline, planPoint);
      const step = gridStep(store, modifiers);
      const snapped =
        step > 0 ? Math.round(projection.offsetMeters / step) * step : projection.offsetMeters;
      const clamped = Math.max(0, Math.min(snapped, polylineLength(centerline)));

      store.moveDevice(this.buildingId, startDevice.id, {
        host: { ...startDevice.host, offsetMeters: clamped },
      });

      return;
    }

    if (startDevice.host.kind === 'ceiling') {
      store.moveDevice(this.buildingId, startDevice.id, {
        host: {
          kind: 'ceiling',
          position: snapPointToGrid(
            store,
            { x: planPoint.x + drag.grabOffset.x, y: planPoint.y + drag.grabOffset.y },
            modifiers
          ),
        },
      });
    }
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

    store.pushHistory();
    this.furnitureDrag = {
      kind: 'rotate',
      startFurniture: furniture,
      grabOffset: { x: 0, y: 0 },
    };

    return true;
  }

  /** Takes hold of the piece under the pointer, topmost first, and selects it. */
  private beginFurnitureDrag(planPoint: Vector2): boolean {
    const { store, getViewport } = this.context;
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
        store.setSelection({
          kind: 'furniture',
          buildingId: this.buildingId,
          furnitureId: item.id,
        });
        store.pushHistory();
        this.furnitureDrag = {
          kind: 'move',
          startFurniture: item,
          grabOffset: offsetBetween(planPoint, item.position),
        };

        return true;
      }
    }

    return false;
  }

  /**
   * Moving snaps to the grid until a wall catches the piece — the Sweet Home
   * 3D magnet turns its back flush against the face; Alt suspends both.
   * Turning snaps the heading the way every other turn on the plan does.
   */
  private dragFurnitureTo(drag: FurnitureDrag, planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;
    const { startFurniture } = drag;

    if (drag.kind === 'rotate') {
      store.moveFurniture(this.buildingId, startFurniture.id, {
        rotationDegrees: normalizeTurnDegrees(
          snapLength(
            bearingDegreesTowards(startFurniture.position, planPoint),
            rotationStepDegrees(modifiers)
          )
        ),
      });

      return;
    }

    const dragged = {
      x: planPoint.x + drag.grabOffset.x,
      y: planPoint.y + drag.grabOffset.y,
    };
    const storey = this.activeStorey();
    const entry = findFurnitureEntry(startFurniture.catalogId);
    const magnetized =
      modifiers.isAltPressed || isNil(storey) || isNil(entry)
        ? undefined
        : magnetizeFurnitureToWall({
            position: dragged,
            depthMeters: entry.depthMeters,
            walls: storey.walls,
            thresholdMeters: FURNITURE_MAGNET_RADIUS_METERS,
          });

    if (!isNil(magnetized)) {
      store.moveFurniture(this.buildingId, startFurniture.id, {
        position: magnetized.position,
        rotationDegrees: normalizeTurnDegrees(magnetized.rotationDegrees),
      });

      return;
    }

    store.moveFurniture(this.buildingId, startFurniture.id, {
      position: snapPointToGrid(store, dragged, modifiers),
      rotationDegrees: startFurniture.rotationDegrees,
    });
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
