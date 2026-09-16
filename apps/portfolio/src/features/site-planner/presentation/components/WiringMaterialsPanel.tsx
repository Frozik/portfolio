import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Check, ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { CableLine } from '../../application/wiring-report';
import type { BuildingId } from '../../domain/model/building';
import type { CableTypeId } from '../../domain/model/cables';
import { CABLE_TYPES } from '../../domain/model/cables';
import { editedBuildingId } from '../../domain/model/editor-mode';
import { DEVICE_KINDS } from '../../domain/model/electrical';
import { INSTALLATION_PRESET_IDS } from '../../domain/model/installation';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';
import { PropertyRow, PropertyValue } from './PropertyRow';

const GLYPH_SIZE_PX = 12;
const LENGTH_DECIMALS = 1;

const CableItem = memo(
  ({
    cableTypeId,
    isSelected,
    onSelect,
  }: {
    readonly cableTypeId: CableTypeId | undefined;
    readonly isSelected: boolean;
    readonly onSelect: (cableTypeId: CableTypeId | undefined) => void;
  }) => {
    const handleSelect = useFunction(() => onSelect(cableTypeId));
    const caption = isNil(cableTypeId)
      ? sitePlannerT.wiring.cableDefault
      : sitePlannerT.wiring.cables[cableTypeId];

    return (
      <DropdownItem
        onSelect={handleSelect}
        className={cn('gap-2 py-1.5 text-xs', isSelected && 'text-brand-500')}
      >
        <Check
          size={GLYPH_SIZE_PX}
          className={cn('shrink-0', !isSelected && 'invisible')}
          aria-hidden
        />
        {caption}
      </DropdownItem>
    );
  }
);

/** One группа's line of the journal: its consumers, its cable — switchable — and its metres. */
const LineRow = observer(
  ({
    store,
    buildingId,
    line,
    ordinal,
    isOverridden,
  }: {
    readonly store: SitePlannerStore;
    readonly buildingId: BuildingId;
    readonly line: CableLine;
    readonly ordinal: number;
    readonly isOverridden: boolean;
  }) => {
    const labels = sitePlannerT.wiring;
    const { meterUnit } = sitePlannerT.plan;

    const handleCableSelect = useFunction((cableTypeId: CableTypeId | undefined) => {
      store.electrics.wiring.setGroupCableType(buildingId, line.groupId, cableTypeId);
    });

    return (
      <div className="flex flex-col gap-1 rounded-md border border-white/10 p-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] text-text">
          <span className="truncate">{`${labels.groupTitle} ${ordinal} · ${labels.consumers(line.consumerCount)}`}</span>
          <span className="shrink-0 font-mono text-text-secondary">
            {formatMeters(line.lengthMeters, meterUnit, LENGTH_DECIMALS)}
          </span>
        </div>
        <PropertyRow label={labels.cableLabel} isControlStretched>
          <Dropdown
            trigger={
              <button
                type="button"
                className={cn(
                  'flex min-w-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1',
                  'text-[11px] text-text transition-colors duration-150 hover:bg-white/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                )}
              >
                <span className="truncate">
                  {labels.cables[line.cableTypeId]}
                  {isOverridden ? '' : ` · ${labels.cableDefault}`}
                </span>
                <ChevronDown
                  size={GLYPH_SIZE_PX}
                  className="shrink-0 text-text-secondary"
                  aria-hidden
                />
              </button>
            }
          >
            <CableItem
              cableTypeId={undefined}
              isSelected={!isOverridden}
              onSelect={handleCableSelect}
            />
            {CABLE_TYPES.map(cable => (
              <CableItem
                key={cable.id}
                cableTypeId={cable.id}
                isSelected={isOverridden && cable.id === line.cableTypeId}
                onSelect={handleCableSelect}
              />
            ))}
          </Dropdown>
        </PropertyRow>
      </div>
    );
  }
);

/**
 * The cable journal of the active storey (`wiring.md` §3.4): a line per
 * группа with its cable and metres, then what it all adds up to — cable by
 * type, metres of each installation method, points by kind. Derived on every
 * change, so it can never disagree with the plan it is printed from.
 */
export const WiringMaterialsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.storeys.editedStoreyScene;
  const labels = sitePlannerT.wiring;
  const { meterUnit } = sitePlannerT.plan;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  const report = scene.wiringReport;
  const groups = scene.storey.groups ?? [];
  const cableRows = CABLE_TYPES.filter(cable => !isNil(report.cableMetersByType[cable.id]));
  const installationRows = INSTALLATION_PRESET_IDS.filter(
    preset => !isNil(report.installationMetersByPreset[preset])
  );
  const pointRows = DEVICE_KINDS.filter(kind => report.deviceCounts[kind] > 0);

  return (
    <PlannerPanel title={labels.materialsPanelTitle}>
      {report.lines.map((line, index) => (
        <LineRow
          key={line.groupId}
          store={store}
          buildingId={buildingId}
          line={line}
          ordinal={index + 1}
          isOverridden={!isNil(groups.find(group => group.id === line.groupId)?.cableTypeId)}
        />
      ))}
      {cableRows.length > 0 ? (
        <span className="font-mono text-[10px] uppercase tracking-wide text-text-secondary">
          {labels.cablesTotal}
        </span>
      ) : undefined}
      {cableRows.map(cable => (
        <PropertyRow key={cable.id} label={labels.cables[cable.id]}>
          <PropertyValue
            value={formatMeters(
              report.cableMetersByType[cable.id] ?? 0,
              meterUnit,
              LENGTH_DECIMALS
            )}
          />
        </PropertyRow>
      ))}
      {installationRows.length > 0 ? (
        <span className="font-mono text-[10px] uppercase tracking-wide text-text-secondary">
          {labels.installationsTotal}
        </span>
      ) : undefined}
      {installationRows.map(preset => (
        <PropertyRow key={preset} label={labels.installations[preset]}>
          <PropertyValue
            value={formatMeters(
              report.installationMetersByPreset[preset] ?? 0,
              meterUnit,
              METER_DECIMALS
            )}
          />
        </PropertyRow>
      ))}
      {pointRows.length > 0 ? (
        <span className="font-mono text-[10px] uppercase tracking-wide text-text-secondary">
          {labels.pointsTotal}
        </span>
      ) : undefined}
      {pointRows.map(kind => (
        <PropertyRow key={kind} label={sitePlannerT.electrical.kinds[kind]}>
          <PropertyValue value={String(report.deviceCounts[kind])} />
        </PropertyRow>
      ))}
      {report.lines.length === 0 ? <PanelHint>{labels.journalEmptyHint}</PanelHint> : undefined}
    </PlannerPanel>
  );
});
