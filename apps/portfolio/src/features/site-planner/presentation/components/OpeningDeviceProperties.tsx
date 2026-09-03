import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { ElectricalDevice } from '../../domain/model/electrical';
import { DEVICE_KINDS, parseDeviceKind } from '../../domain/model/electrical';
import type { FurnitureInstance } from '../../domain/model/furniture';
import type { Opening } from '../../domain/model/openings';
import { OPENING_PRESETS, parseOpeningPreset } from '../../domain/model/openings';
import { normalizeTurnDegrees } from '../../domain/units';
import { DEGREE_DECIMALS, METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PropertyField } from './PropertyField';
import { PropertyRow, PropertyValue } from './PropertyRow';

const OPENING_PRESET_OPTIONS = OPENING_PRESETS.map(preset => ({
  value: preset,
  label: sitePlannerT.openings.presets[preset],
}));

const DEVICE_KIND_OPTIONS = DEVICE_KINDS.map(kind => ({
  value: kind,
  label: sitePlannerT.electrical.kinds[kind],
}));

/**
 * An opening taken hold of inside the building editor. Its position is one
 * number — the offset along its host wall — and its heights are typed; the
 * kind never changes (a door replaced by a window is a delete and a click).
 */
export const SelectedOpeningProperties = observer(
  ({ store, opening }: { readonly store: SitePlannerStore; readonly opening: Opening }) => {
    const { selection } = store;
    const buildingId = selection?.kind === 'opening' ? selection.buildingId : undefined;
    const labels = sitePlannerT.openings;

    const handleOffsetChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.walls.updateOpeningProperties(buildingId, opening.id, { offsetMeters: value });
      }
    });
    const handleWidthChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.walls.updateOpeningProperties(buildingId, opening.id, { widthMeters: value });
      }
    });
    const handleSillChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.walls.updateOpeningProperties(buildingId, opening.id, { sillMeters: value });
      }
    });
    const handleHeadChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.walls.updateOpeningProperties(buildingId, opening.id, { headMeters: value });
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.kinds[opening.kind]}>
          <PropertyValue value="" />
        </PropertyRow>
        <PropertyField
          label={labels.offset}
          value={opening.offsetMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleOffsetChange}
        />
        <PropertyField
          label={labels.width}
          value={opening.widthMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleWidthChange}
        />
        <PropertyField
          label={labels.sill}
          value={opening.sillMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleSillChange}
        />
        <PropertyField
          label={labels.head}
          value={opening.headMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleHeadChange}
        />
        <PanelHint>{labels.hint}</PanelHint>
      </div>
    );
  }
);

/**
 * A placed piece: where it stands, which way it faces, and how high above the
 * floor it sits — the elevation that hangs a boiler on a wall.
 */
export const SelectedFurnitureProperties = observer(
  ({
    store,
    furniture,
  }: {
    readonly store: SitePlannerStore;
    readonly furniture: FurnitureInstance;
  }) => {
    const { selection } = store;
    const buildingId = selection?.kind === 'furniture' ? selection.buildingId : undefined;
    const labels = sitePlannerT.furniture;

    const handleXChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.storeyObjects.updateFurnitureProperties(buildingId, furniture.id, {
          position: { x: value, y: furniture.position.y },
        });
      }
    });
    const handleYChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.storeyObjects.updateFurnitureProperties(buildingId, furniture.id, {
          position: { x: furniture.position.x, y: value },
        });
      }
    });
    const handleRotationChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.storeyObjects.updateFurnitureProperties(buildingId, furniture.id, {
          rotationDegrees: normalizeTurnDegrees(value),
        });
      }
    });
    const handleElevationChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.storeyObjects.updateFurnitureProperties(buildingId, furniture.id, {
          elevationMeters: value,
        });
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.items[furniture.catalogId]}>
          <PropertyValue value="" />
        </PropertyRow>
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={furniture.position.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handleXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={furniture.position.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handleYChange}
        />
        <PropertyField
          label={sitePlannerT.properties.rotation}
          value={furniture.rotationDegrees}
          decimal={DEGREE_DECIMALS}
          allowNegative
          onValueChange={handleRotationChange}
        />
        <PropertyField
          label={labels.elevation}
          value={furniture.elevationMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleElevationChange}
        />
        <PanelHint>{labels.hint}</PanelHint>
      </div>
    );
  }
);

/**
 * A placed device: a wall one slides by its offset and mounts at its height;
 * a ceiling light stands at a free point.
 */
export const SelectedDeviceProperties = observer(
  ({ store, device }: { readonly store: SitePlannerStore; readonly device: ElectricalDevice }) => {
    const { selection } = store;
    const buildingId = selection?.kind === 'device' ? selection.buildingId : undefined;
    const labels = sitePlannerT.electrical;
    const { host } = device;

    const handleOffsetChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value) && host.kind === 'wall') {
        store.storeyObjects.updateDeviceProperties(buildingId, device.id, {
          host: { ...host, offsetMeters: value },
        });
      }
    });
    const handleHeightChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value) && host.kind === 'wall') {
        store.storeyObjects.updateDeviceProperties(buildingId, device.id, {
          host: { ...host, heightMeters: value },
        });
      }
    });
    const handleXChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value) && host.kind === 'ceiling') {
        store.storeyObjects.updateDeviceProperties(buildingId, device.id, {
          host: { kind: 'ceiling', position: { x: value, y: host.position.y } },
        });
      }
    });
    const handleYChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value) && host.kind === 'ceiling') {
        store.storeyObjects.updateDeviceProperties(buildingId, device.id, {
          host: { kind: 'ceiling', position: { x: host.position.x, y: value } },
        });
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.kinds[device.kind]}>
          <PropertyValue value="" />
        </PropertyRow>
        {host.kind === 'wall' ? (
          <>
            <PropertyField
              label={labels.offset}
              value={host.offsetMeters}
              decimal={METER_DECIMALS}
              onValueChange={handleOffsetChange}
            />
            <PropertyField
              label={labels.height}
              value={host.heightMeters}
              decimal={METER_DECIMALS}
              onValueChange={handleHeightChange}
            />
          </>
        ) : (
          <>
            <PropertyField
              label={sitePlannerT.properties.centerX}
              value={host.position.x}
              decimal={METER_DECIMALS}
              allowNegative
              onValueChange={handleXChange}
            />
            <PropertyField
              label={sitePlannerT.properties.centerY}
              value={host.position.y}
              decimal={METER_DECIMALS}
              allowNegative
              onValueChange={handleYChange}
            />
          </>
        )}
        <PanelHint>{labels.deviceHint}</PanelHint>
      </div>
    );
  }
);

/** With the opening tool in hand, the panel is where the preset is armed. */
export const OpeningToolProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const labels = sitePlannerT.openings;

  const handlePresetChange = useFunction((value: string) => {
    const preset = parseOpeningPreset(value);

    if (!isNil(preset)) {
      store.walls.setArmedOpeningPreset(preset);
    }
  });

  return (
    <div className="flex flex-col gap-2">
      <PropertyRow label={labels.presetLabel} isControlStretched>
        <RadioGroup
          value={store.walls.armedOpeningPreset}
          options={OPENING_PRESET_OPTIONS}
          onChange={handlePresetChange}
        />
      </PropertyRow>
      <PanelHint>{labels.toolHint}</PanelHint>
    </div>
  );
});

/** With the electric tool in hand, the panel is where the device kind is armed. */
export const ElectricToolProperties = observer(
  ({ store }: { readonly store: SitePlannerStore }) => {
    const labels = sitePlannerT.electrical;

    const handleKindChange = useFunction((value: string) => {
      const kind = parseDeviceKind(value);

      if (!isNil(kind)) {
        store.storeyObjects.setArmedDeviceKind(kind);
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.armedLabel} isControlStretched>
          <RadioGroup
            value={store.storeyObjects.armedDeviceKind}
            options={DEVICE_KIND_OPTIONS}
            onChange={handleKindChange}
          />
        </PropertyRow>
        <PanelHint>{labels.toolHint}</PanelHint>
      </div>
    );
  }
);
