import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { makeAutoObservable } from 'mobx';

import type { BuildingId } from '../domain/model/building';
import type { EditTarget } from '../domain/model/editor-mode';
import type { DeviceId, DeviceKind } from '../domain/model/electrical';
import { DEFAULT_DEVICE_KIND } from '../domain/model/electrical';
import type { FireplaceKind } from '../domain/model/fireplaces';
import type { FurnitureCatalogId } from '../domain/model/furniture';
import { DEFAULT_FURNITURE_CATALOG_ID } from '../domain/model/furniture';
import type { OpeningPreset } from '../domain/model/openings';
import { DEFAULT_OPENING_PRESET } from '../domain/model/openings';
import type { StairKind } from '../domain/model/stairs';
import { DEFAULT_STAIR_KIND } from '../domain/model/stairs';
import type { StoreyId } from '../domain/model/storeys';

/**
 * The transient state one editor visit owns — created by `enterEditMode`,
 * disposed by `exitEditMode`, never persisted (see `object-editors.md`). What
 * lives here is the editor's own sub-world: which of the path's points is
 * being edited today; which storey is active and which wall is selected once
 * the building editor exists. The store keeps thin facades over the current
 * session, so panels keep one access point while the state's lifetime is the
 * editor visit, not the store.
 */
class SiteEditSession {
  readonly kind = 'site';

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** Nothing to tear down yet; the lifecycle seam the building editor will use. */
  dispose(): void {}
}

class PathEditSession {
  readonly kind = 'path';
  /** The point being edited inside path editing. */
  selectedPointIndex: number | undefined = undefined;
  /** The segment whose panel block the pointer rests on; lit on the plan. */
  hoveredSegmentIndex: number | undefined = undefined;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setSelectedPointIndex(index: number | undefined): void {
    this.selectedPointIndex = index;
  }

  /** Guarded against no-op writes: the pointer reports every move, the canvas need not redraw for each. */
  setHoveredSegmentIndex(index: number | undefined): void {
    if (this.hoveredSegmentIndex !== index) {
      this.hoveredSegmentIndex = index;
    }
  }

  dispose(): void {}
}

class RouteEditSession {
  readonly kind = 'utilityRoute';

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** The trench editor keeps no sub-state yet; the lifecycle seam stands. */
  dispose(): void {}
}

class BuildingEditSession {
  readonly kind = 'building';
  readonly buildingId: BuildingId;
  /** The polyline of the wall being clicked out; empty while none is. */
  draftWallPoints: readonly Vector2[] = [];
  /** What the opening tool places next — door, window, or окно в пол. */
  armedOpeningPreset: OpeningPreset = DEFAULT_OPENING_PRESET;
  /** What the furniture tool places next, chosen in the МЕБЕЛЬ panel. */
  armedFurnitureId: FurnitureCatalogId = DEFAULT_FURNITURE_CATALOG_ID;
  /** What the electric tool places next. */
  armedDeviceKind: DeviceKind = DEFAULT_DEVICE_KIND;
  /** The first device a connect gesture has taken; the second click wires them. */
  pendingConnectDeviceId: DeviceId | undefined = undefined;
  /** The room row the pointer rests on in КОМНАТЫ; its region lights on the plan. */
  hoveredRoomIndex: number | undefined = undefined;
  /** The storey being edited; nothing means the ground storey. */
  activeStoreyId: StoreyId | undefined = undefined;
  /** Chief Architect's reference display: the storey below ghosts through. */
  isReferenceStoreyVisible = true;

  constructor(buildingId: BuildingId) {
    makeAutoObservable(this, {}, { autoBind: true });
    this.buildingId = buildingId;
  }

  /** The stair kind the flyout is armed with; sticky, like every other tool. */
  armedStairKind: StairKind = DEFAULT_STAIR_KIND;

  setArmedStairKind(armedStairKind: StairKind): void {
    this.armedStairKind = armedStairKind;
  }

  /** Which fire the flyout is armed with — a fireplace, a stove, a sauna's. */
  armedFireplaceKind: FireplaceKind = 'fireplace';

  setArmedFireplaceKind(armedFireplaceKind: FireplaceKind): void {
    this.armedFireplaceKind = armedFireplaceKind;
  }

  appendDraftWallPoint(point: Vector2): void {
    this.draftWallPoints = [...this.draftWallPoints, point];
  }

  /** Peels the last corner back — the Backspace of every polyline tool. */
  dropLastDraftWallPoint(): void {
    this.draftWallPoints = this.draftWallPoints.slice(0, -1);
  }

  clearDraftWall(): void {
    this.draftWallPoints = [];
  }

  setArmedOpeningPreset(preset: OpeningPreset): void {
    this.armedOpeningPreset = preset;
  }

  setArmedFurnitureId(catalogId: FurnitureCatalogId): void {
    this.armedFurnitureId = catalogId;
  }

  setArmedDeviceKind(kind: DeviceKind): void {
    this.armedDeviceKind = kind;
  }

  setPendingConnectDeviceId(deviceId: DeviceId | undefined): void {
    this.pendingConnectDeviceId = deviceId;
  }

  /** Guarded against no-op writes: the pointer reports every move, the canvas need not redraw for each. */
  setHoveredRoomIndex(index: number | undefined): void {
    if (this.hoveredRoomIndex !== index) {
      this.hoveredRoomIndex = index;
    }
  }

  setActiveStoreyId(storeyId: StoreyId | undefined): void {
    this.activeStoreyId = storeyId;
  }

  toggleReferenceStorey(): void {
    this.isReferenceStoreyVisible = !this.isReferenceStoreyVisible;
  }

  dispose(): void {}
}

export type EditorSession =
  | SiteEditSession
  | PathEditSession
  | RouteEditSession
  | BuildingEditSession;

export function createEditorSession(target: EditTarget): EditorSession {
  switch (target.kind) {
    case 'site':
      return new SiteEditSession();
    case 'path':
      return new PathEditSession();
    case 'utilityRoute':
      return new RouteEditSession();
    case 'building':
      return new BuildingEditSession(target.buildingId);
    default:
      return assertNever(target);
  }
}
