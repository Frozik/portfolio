import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import { getShapeKeyPoints } from '../domain/geometry/shape-key-points';
import { setRectangleRotation } from '../domain/geometry/transform-shape';
import { findBuilding as findBuildingIn } from '../domain/model/building-edits';
import {
  addDevice as addDeviceIn,
  assignDeviceToPanel as assignDeviceToPanelIn,
  findDevice as findDeviceIn,
  linkSwitchToLight as linkSwitchToLightIn,
  updateDevice as updateDeviceIn,
} from '../domain/model/device-edits';
import type { DuctId, VerticalDuct } from '../domain/model/ducts';
import { createDuct } from '../domain/model/ducts';
import type { DeviceId, DeviceKind, ElectricalDevice } from '../domain/model/electrical';
import {
  createCeilingLight,
  createWallDevice,
  DEFAULT_DEVICE_KIND,
} from '../domain/model/electrical';
import type { Fireplace, FireplaceId, FireplaceKind } from '../domain/model/fireplaces';
import { createFireplace } from '../domain/model/fireplaces';
import type { FurnitureCatalogId, FurnitureId, FurnitureInstance } from '../domain/model/furniture';
import { createFurniture, DEFAULT_FURNITURE_CATALOG_ID } from '../domain/model/furniture';
import type { Selection } from '../domain/model/selection';
import type { ShapeId } from '../domain/model/shapes';
import { isBoxedShape } from '../domain/model/shapes';
import type { BuildingId } from '../domain/model/site-plan';
import { storeysOf } from '../domain/model/site-plan';
import type { Slab } from '../domain/model/slabs';
import { createSlab, NO_SLABS } from '../domain/model/slabs';
import type { StairId, StairInstance, StairKind } from '../domain/model/stairs';
import { createStair, DEFAULT_STAIR_KIND } from '../domain/model/stairs';
import {
  addStoreyObject,
  findStoreyObject,
  updateStoreyObject,
} from '../domain/model/storey-edits';
import type { SelectedStoreyObject } from '../domain/model/storey-object-selection';
import {
  selectedStoreyObject,
  storeyObjectSelector,
} from '../domain/model/storey-object-selection';
import type { StoreyObjectKey } from '../domain/model/storey-objects';
import {
  DUCT_OBJECTS,
  FIREPLACE_OBJECTS,
  FURNITURE_OBJECTS,
  SLAB_OBJECTS,
  STAIR_OBJECTS,
  SUPPORT_OBJECTS,
} from '../domain/model/storey-objects';
import type { SupportId, SupportPost } from '../domain/model/supports';
import { createSupport } from '../domain/model/supports';
import type { WallId } from '../domain/model/walls';
import type { Meters } from '../domain/units';
import { normalizeTurnDegrees } from '../domain/units';
import { wallSnapPoints } from '../domain/view/object-snapping';
import type { BuildingModel } from './BuildingModel';
import type { PlanEditorCore } from './editor-core';
import type { SceneModel } from './SceneModel';
import type { StairScene } from './storey-scenes';

/**
 * What stands INSIDE the open building, storey by storey: stairs, supports,
 * slabs, fireplaces, ducts, furniture and the electrical devices with their
 * wiring — placed, dragged, turned and taken away, each kind through the
 * storey-object registry. Owns the tools' armed kinds via the session.
 */
/** A quarter turn: what the ⟳ button adds, staying on the compass points. */
const QUARTER_TURN_DEGREES = 90;
const FURNITURE_HISTORY_GROUP = 'furniture';
const DEVICE_HISTORY_GROUP = 'device';
const NO_SNAP_POINTS: readonly Vector2[] = [];

/** Every corner of an outline — what a floor is aligned to when no wall is. */
function outlineCorners(polygons: MultiPolygon): readonly Vector2[] {
  return polygons.flatMap(polygon => [polygon.outer, ...polygon.holes].flat());
}

export class StoreyObjectsEditorModel {
  private readonly core: PlanEditorCore;
  private readonly scene: SceneModel;
  private readonly building: BuildingModel;

  constructor(core: PlanEditorCore, scene: SceneModel, building: BuildingModel) {
    this.core = core;
    this.scene = scene;
    this.building = building;

    makeAutoObservable<StoreyObjectsEditorModel, 'core' | 'scene' | 'building'>(
      this,
      { core: false, scene: false, building: false },
      { autoBind: true }
    );
  }

  /** Which stair the tool will place next — the flyout's armed catalogue row. */
  get armedStairKind(): StairKind {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedStairKind
      : DEFAULT_STAIR_KIND;
  }

  setArmedStairKind(kind: StairKind): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedStairKind(kind);
    }
  }

  /**
   * Puts a stair on the active storey, climbing toward the storey above. It
   * lands where it was clicked, its run derived from that storey's floor to
   * floor — the footprint is an output, so there is nothing to size by hand.
   */
  placeStairAt(planPoint: Vector2): void {
    const session = this.core.editorSession;
    const storeyId = this.building.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      STAIR_OBJECTS,
      createStair({ kind: session.armedStairKind, position: planPoint })
    );
  }

  /**
   * Puts a post where it was clicked. Both of its ends derive — the floor or
   * the graded ground beneath it, the storey's ceiling above — so a canopy on
   * a slope gets posts of the right, different lengths without anyone typing
   * a number.
   */
  placeSupportAt(planPoint: Vector2): void {
    const session = this.core.editorSession;
    const storeyId = this.building.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      SUPPORT_OBJECTS,
      createSupport({ position: planPoint })
    );
  }

  /**
   * Puts a fireplace where it was clicked (R34). Its flue is DERIVED — it
   * rises behind the firebox, through every storey above and out of the roof
   * at the height СП 7.13130 asks for — so a fireplace dragged across the room
   * takes its chimney with it and nothing has to be re-drawn.
   */
  placeFireplaceAt(planPoint: Vector2): void {
    const session = this.core.editorSession;
    const storeyId = this.building.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    const fireplace = createFireplace({ kind: session.armedFireplaceKind, position: planPoint });

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      FIREPLACE_OBJECTS,
      fireplace
    );
    this.core.setSelection({
      kind: 'fireplace',
      buildingId: session.buildingId,
      fireplaceId: fireplace.id,
    });
  }

  /** Slides or turns a fireplace; a drag stays one step to undo. */
  moveFireplace(
    buildingId: BuildingId,
    fireplaceId: FireplaceId,
    changes: Partial<Omit<Fireplace, 'id' | 'kind'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      FIREPLACE_OBJECTS,
      fireplaceId,
      changes
    );
  }

  /** Turns a fireplace by a quarter — the quick way to aim it into the room. */
  rotateFireplaceByQuarter(buildingId: BuildingId, fireplaceId: FireplaceId): void {
    const fireplace = findStoreyObject(
      this.core.buildings,
      buildingId,
      FIREPLACE_OBJECTS,
      fireplaceId
    );

    if (isNil(fireplace)) {
      return;
    }

    this.core.pushHistory();
    this.moveFireplace(buildingId, fireplaceId, {
      rotationDegrees: normalizeTurnDegrees(fireplace.rotationDegrees + QUARTER_TURN_DEGREES),
    });
  }

  removeFireplaceFrom(buildingId: BuildingId, fireplaceId: FireplaceId): void {
    this.takeStoreyObjectAway('fireplace', buildingId, fireplaceId);
  }

  /** Plants a ventilation shaft on the active storey (R35). */
  placeDuctAt(planPoint: Vector2): void {
    const session = this.core.editorSession;
    const storeyId = this.building.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    const duct = createDuct({ kind: 'vent', position: planPoint });

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      DUCT_OBJECTS,
      duct
    );
    this.core.setSelection({ kind: 'duct', buildingId: session.buildingId, ductId: duct.id });
  }

  /**
   * How high a shaft comes out, by its id — the derived number the panels
   * state. A fireplace's flue answers to the fireplace's own id.
   */
  ductTopElevationOf(ductId: string): Meters | undefined {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return undefined;
    }

    return this.scene.buildingScenes
      .find(candidate => candidate.building.id === session.buildingId)
      ?.ducts.find(run => run.duct.id === ductId)?.topElevation;
  }

  /** Which fire the rail's flyout is armed with. */
  get armedFireplaceKind(): FireplaceKind {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedFireplaceKind
      : 'fireplace';
  }

  setArmedFireplaceKind(kind: FireplaceKind): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedFireplaceKind(kind);
    }
  }

  /** Slides a shaft; the drag announced its own history step when it began. */
  moveDuct(
    buildingId: BuildingId,
    ductId: DuctId,
    changes: Partial<Omit<VerticalDuct, 'id' | 'kind'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      DUCT_OBJECTS,
      ductId,
      changes
    );
  }

  removeDuctFrom(buildingId: BuildingId, ductId: DuctId): void {
    this.takeStoreyObjectAway('duct', buildingId, ductId);
  }

  /**
   * Lays a slab where it was clicked — the floor of an upper storey, drawn as
   * an object rather than derived from the walls. A cantilevered second floor
   * needs a floor of its own to stand on, and walls are then held to it. The
   * plate that lands is a plain shape, so the tool that drew it can be any of
   * the primitives the plot itself is drawn with.
   */
  placeSlabAt(planPoint: Vector2): void {
    this.addSlab(createSlab(planPoint));
  }

  /** Puts a drawn slab on the active storey and selects it. */
  addSlab(slab: Slab): void {
    const session = this.core.editorSession;
    const storeyId = this.building.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      SLAB_OBJECTS,
      slab
    );
    this.core.setSelection({ kind: 'slab', buildingId: session.buildingId, slabId: slab.id });
  }

  /** Writes a slab back; a drag announced its own history step when it began. */
  updateSlab(buildingId: BuildingId, slab: Slab): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      SLAB_OBJECTS,
      slab.id,
      slab
    );
  }

  /** Turns a slab by a quarter, the way a stair or a table turns. */
  rotateSlabByQuarter(buildingId: BuildingId, slabId: ShapeId): void {
    const slab = findStoreyObject(this.core.buildings, buildingId, SLAB_OBJECTS, slabId);

    if (isNil(slab) || !isBoxedShape(slab)) {
      return;
    }

    this.core.pushHistory();
    this.updateSlab(
      buildingId,
      setRectangleRotation(slab, slab.rotationDegrees + QUARTER_TURN_DEGREES)
    );
  }

  removeSlabFrom(buildingId: BuildingId, slabId: ShapeId): void {
    this.takeStoreyObjectAway('slab', buildingId, slabId);
  }

  /** Slides a post; the drag announced its own history step when it began. */
  moveSupport(
    buildingId: BuildingId,
    supportId: SupportId,
    changes: Partial<Omit<SupportPost, 'id'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      SUPPORT_OBJECTS,
      supportId,
      changes
    );
  }

  removeSupportFrom(buildingId: BuildingId, supportId: SupportId): void {
    this.takeStoreyObjectAway('support', buildingId, supportId);
  }

  /** Slides or turns a stair; a drag stays one step to undo, like furniture. */
  moveStair(
    buildingId: BuildingId,
    stairId: StairId,
    changes: Partial<Omit<StairInstance, 'id' | 'kind'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      STAIR_OBJECTS,
      stairId,
      changes
    );
  }

  /**
   * Turns a stair by a quarter — the quick way to aim it along a wall. The
   * grip is for the odd angle; this is for the four that a room actually
   * wants, and it takes one click rather than an aimed drag.
   */
  rotateStairByQuarter(buildingId: BuildingId, stairId: StairId): void {
    const stair = findStoreyObject(this.core.buildings, buildingId, STAIR_OBJECTS, stairId);

    if (isNil(stair)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      STAIR_OBJECTS,
      stairId,
      {
        rotationDegrees: normalizeTurnDegrees(stair.rotationDegrees + QUARTER_TURN_DEGREES),
      }
    );
  }

  /** Flips a stair to its other hand — the mirrored plan of the same stair. */
  mirrorStair(buildingId: BuildingId, stairId: StairId): void {
    const stair = findStoreyObject(this.core.buildings, buildingId, STAIR_OBJECTS, stairId);

    if (isNil(stair)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      STAIR_OBJECTS,
      stairId,
      {
        isMirrored: stair.isMirrored !== true,
      }
    );
  }

  removeStairFrom(buildingId: BuildingId, stairId: StairId): void {
    this.takeStoreyObjectAway('stair', buildingId, stairId);
  }

  /**
   * What a slab is magnetised to while it is drawn, dragged or resized: the
   * corners and side middles of the walls STANDING BELOW it, the corners of the
   * storey below's own outline, its own storey's walls, and the other slabs of
   * that storey. Positioning a floor by eye against the rooms underneath is
   * hopeless — this is what makes «flush with the wall downstairs» a gesture.
   */
  slabSnapPoints(excludedShapeId: ShapeId): readonly Vector2[] {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return NO_SNAP_POINTS;
    }

    const scene = this.scene.buildingScenes.find(
      candidate => candidate.building.id === session.buildingId
    );
    const level = this.building.editedStoreyScene?.level;

    if (isNil(scene) || isNil(level)) {
      return NO_SNAP_POINTS;
    }

    const own = scene.storeys[level];
    const below = scene.storeys[level - 1];

    return [
      ...wallSnapPoints(own.storey.walls),
      ...own.slabs.filter(slab => slab.id !== excludedShapeId).flatMap(getShapeKeyPoints),
      ...(isNil(below)
        ? []
        : [...wallSnapPoints(below.storey.walls), ...outlineCorners(below.footprint)]),
    ];
  }

  /** The slabs of the storey being edited — the floor its walls are held to. */
  get activeStoreySlabs(): readonly Slab[] {
    return this.building.editedStoreyScene?.slabs ?? NO_SLABS;
  }

  /** The furniture the selection names, when it still exists. */
  get selectedFurniture(): FurnitureInstance | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'furniture'
      ? undefined
      : findStoreyObject(
          this.core.buildings,
          selection.buildingId,
          FURNITURE_OBJECTS,
          selection.furnitureId
        );
  }

  /** What the furniture tool places next, chosen in the МЕБЕЛЬ panel. */
  get armedFurnitureId(): FurnitureCatalogId {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedFurnitureId
      : DEFAULT_FURNITURE_CATALOG_ID;
  }

  setArmedFurnitureId(catalogId: FurnitureCatalogId): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedFurnitureId(catalogId);
    }
  }

  /** Places the armed piece on the active storey — one step to undo, selected. */
  placeFurnitureAt(buildingId: BuildingId, position: Vector2): void {
    const building = findBuildingIn(this.core.buildings, buildingId);
    const storeyId =
      this.building.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);

    if (isNil(storeyId)) {
      return;
    }

    const furniture = createFurniture({ catalogId: this.armedFurnitureId, position });

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      buildingId,
      storeyId,
      FURNITURE_OBJECTS,
      furniture
    );
    this.core.setSelection({ kind: 'furniture', buildingId, furnitureId: furniture.id });
  }

  /**
   * Edits a piece field by field. Typed numbers group per piece, so a burst
   * of keystrokes stays one step to undo.
   */
  updateFurnitureProperties(
    buildingId: BuildingId,
    furnitureId: FurnitureId,
    changes: Partial<Omit<FurnitureInstance, 'id' | 'catalogId'>>
  ): void {
    this.core.pushHistory(`${FURNITURE_HISTORY_GROUP}:${furnitureId}`);
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      FURNITURE_OBJECTS,
      furnitureId,
      changes
    );
  }

  /** Follows the pointer; the caller announces the history step it belongs to. */
  moveFurniture(
    buildingId: BuildingId,
    furnitureId: FurnitureId,
    changes: Partial<Omit<FurnitureInstance, 'id' | 'catalogId'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      FURNITURE_OBJECTS,
      furnitureId,
      changes
    );
  }

  removeFurniture(buildingId: BuildingId, furnitureId: FurnitureId): void {
    this.takeStoreyObjectAway('furniture', buildingId, furnitureId);
  }

  /** The device the selection names, when it still exists. */
  get selectedDevice(): ElectricalDevice | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'device'
      ? undefined
      : findDeviceIn(this.core.buildings, selection.buildingId, selection.deviceId);
  }

  /** What the electric tool places next. */
  get armedDeviceKind(): DeviceKind {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedDeviceKind
      : DEFAULT_DEVICE_KIND;
  }

  setArmedDeviceKind(kind: DeviceKind): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedDeviceKind(kind);
    }
  }

  /** The first half of a connect gesture, echoed by the panel and the plan. */
  get pendingConnectDeviceId(): DeviceId | undefined {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.pendingConnectDeviceId
      : undefined;
  }

  setPendingConnectDeviceId(deviceId: DeviceId | undefined): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setPendingConnectDeviceId(deviceId);
    }
  }

  /** Hangs a wall device at its conventional height — one step to undo, selected. */
  addWallDeviceAt(
    buildingId: BuildingId,
    kind: Exclude<DeviceKind, 'light'>,
    wallId: WallId,
    offsetMeters: Meters
  ): void {
    const device = createWallDevice({ kind, wallId, offsetMeters });
    const storeyId = this.building.resolveActiveStoreyId(buildingId);

    if (isNil(storeyId)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = addDeviceIn(this.core.buildings, buildingId, storeyId, device);
    this.core.setSelection({ kind: 'device', buildingId, deviceId: device.id });
  }

  /** Puts a light on the ceiling of the active storey — one step, selected. */
  addCeilingLightAt(buildingId: BuildingId, position: Vector2): void {
    const device = createCeilingLight(position);
    const storeyId = this.building.resolveActiveStoreyId(buildingId);

    if (isNil(storeyId)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = addDeviceIn(this.core.buildings, buildingId, storeyId, device);
    this.core.setSelection({ kind: 'device', buildingId, deviceId: device.id });
  }

  /**
   * Edits a device field by field. Typed numbers group per device, so a burst
   * of keystrokes stays one step to undo.
   */
  updateDeviceProperties(
    buildingId: BuildingId,
    deviceId: DeviceId,
    changes: Partial<Omit<ElectricalDevice, 'id' | 'kind'>>
  ): void {
    this.core.pushHistory(`${DEVICE_HISTORY_GROUP}:${deviceId}`);
    this.core.buildings = updateDeviceIn(this.core.buildings, buildingId, deviceId, changes);
  }

  /** Follows the pointer; the caller announces the history step it belongs to. */
  moveDevice(
    buildingId: BuildingId,
    deviceId: DeviceId,
    changes: Partial<Omit<ElectricalDevice, 'id' | 'kind'>>
  ): void {
    this.core.buildings = updateDeviceIn(this.core.buildings, buildingId, deviceId, changes);
  }

  removeDevice(buildingId: BuildingId, deviceId: DeviceId): void {
    this.takeStoreyObjectAway('device', buildingId, deviceId);
  }

  /**
   * The connect tool's second click: panel + consumer joins the группа,
   * switch + light ties the link — whichever order the two were clicked in.
   */
  connectDevices(buildingId: BuildingId, firstId: DeviceId, secondId: DeviceId): void {
    const first = findDeviceIn(this.core.buildings, buildingId, firstId);
    const second = findDeviceIn(this.core.buildings, buildingId, secondId);

    if (isNil(first) || isNil(second) || firstId === secondId) {
      return;
    }

    if (first.kind === 'panel' || second.kind === 'panel') {
      const [panel, consumer] = first.kind === 'panel' ? [first, second] : [second, first];

      if (consumer.kind === 'panel') {
        return;
      }

      this.core.pushHistory();
      this.core.buildings = assignDeviceToPanelIn(
        this.core.buildings,
        buildingId,
        panel.id,
        consumer.id
      );

      return;
    }

    const kinds = new Set([first.kind, second.kind]);

    if (kinds.has('switch') && kinds.has('light')) {
      const switchId = first.kind === 'switch' ? first.id : second.id;
      const lightId = first.kind === 'light' ? first.id : second.id;

      this.core.pushHistory();
      this.core.buildings = linkSwitchToLightIn(this.core.buildings, buildingId, switchId, lightId);
    }
  }

  /** The selected stair, resolved against the active storey's scene. */
  get selectedStairScene(): StairScene | undefined {
    const { selection } = this.core;

    return selection?.kind === 'stair'
      ? this.building.editedStoreyScene?.stairs.find(
          stairScene => stairScene.stair.id === selection.stairId
        )
      : undefined;
  }

  removeSelectedStoreyObject(selection: Selection): void {
    const selected = selectedStoreyObject(selection);

    if (!isNil(selected)) {
      this.takeStoreyObjectAway(selected.selector.key, selected.buildingId, selected.id);
    }
  }

  /**
   * Takes one storey object off its storey — whichever kind it is — and drops
   * any selection that named it. The kinds differ in what removal MEANS only
   * for a device, which is unwired as it goes; the table carries that
   * difference, so every caller here is one line.
   */
  private takeStoreyObjectAway(key: StoreyObjectKey, buildingId: BuildingId, id: string): void {
    const selector = storeyObjectSelector(key);

    this.core.pushHistory();
    this.core.buildings = selector.remove(this.core.buildings, buildingId, id);
    this.dropSelectionsNaming({ selector, buildingId, id });
  }

  /** Drops whatever selection pointed at an object that has just left the plan. */
  private dropSelectionsNaming(selected: SelectedStoreyObject): void {
    this.core.selections = this.core.selections.filter(candidate => {
      const named = selectedStoreyObject(candidate);

      return (
        isNil(named) ||
        named.selector.key !== selected.selector.key ||
        named.id !== selected.id ||
        named.buildingId !== selected.buildingId
      );
    });
  }
}
