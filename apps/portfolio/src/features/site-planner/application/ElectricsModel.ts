import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { BuildingId } from '../domain/model/building';
import {
  addDevice as addDeviceIn,
  assignDeviceToPanel as assignDeviceToPanelIn,
  findDevice as findDeviceIn,
  linkSwitchToLight as linkSwitchToLightIn,
  updateDevice as updateDeviceIn,
} from '../domain/model/device-edits';
import type { DeviceId, DeviceKind, ElectricalDevice } from '../domain/model/electrical';
import {
  createCeilingLight,
  createWallDevice,
  DEFAULT_DEVICE_KIND,
} from '../domain/model/electrical';
import type { WallId } from '../domain/model/walls';
import type { Meters } from '../domain/units';
import type { PlanEditorCore } from './editor-core';
import { takeStoreyObjectAway } from './storey-object-removal';
import type { StoreysModel } from './StoreysModel';

const DEVICE_HISTORY_GROUP = 'device';

/**
 * The electrics of the open building: the armed device kind, hanging devices
 * on walls and lights on ceilings, and the connect gesture that wires a
 * consumer to its panel or a switch to its light.
 */
export class ElectricsModel {
  private readonly core: PlanEditorCore;
  private readonly storeys: StoreysModel;

  constructor(core: PlanEditorCore, storeys: StoreysModel) {
    this.core = core;
    this.storeys = storeys;

    makeAutoObservable<ElectricsModel, 'core' | 'storeys'>(
      this,
      { core: false, storeys: false },
      { autoBind: true }
    );
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
    const storeyId = this.storeys.resolveActiveStoreyId(buildingId);

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
    const storeyId = this.storeys.resolveActiveStoreyId(buildingId);

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
    takeStoreyObjectAway(this.core, 'device', buildingId, deviceId);
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

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
