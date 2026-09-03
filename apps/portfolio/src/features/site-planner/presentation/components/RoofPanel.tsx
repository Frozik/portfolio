import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { clamp, isNil } from 'lodash-es';
import { Check, ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { RoofZoneScene, SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import {
  MAX_ROOF_PITCH_DEGREES,
  MIN_ROOF_PITCH_DEGREES,
  PITCHED_ROOF_KINDS,
  parsePitchedRoofKind,
} from '../../domain/model/roofs';
import type { BuildingId } from '../../domain/model/site-plan';
import type { RoofCover } from '../../domain/model/storeys';
import { ROOF_COVERS } from '../../domain/model/storeys';
import { normalizeTurnDegrees } from '../../domain/units';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';
import { PropertyField } from './PropertyField';
import { PropertyRow, PropertyValue } from './PropertyRow';

const GLYPH_SIZE_PX = 12;
const AREA_DECIMALS = 1;

const CoverItem = memo(
  ({
    cover,
    isSelected,
    onSelect,
  }: {
    readonly cover: RoofCover;
    readonly isSelected: boolean;
    readonly onSelect: (cover: RoofCover) => void;
  }) => {
    const handleSelect = useFunction(() => onSelect(cover));

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
        {sitePlannerT.roof.covers[cover]}
      </DropdownItem>
    );
  }
);

/** One exposed-ceiling region's row: what covers it, and how much of it there is. */
const ZoneRow = observer(
  ({
    store,
    buildingId,
    zone,
    ordinal,
  }: {
    readonly store: SitePlannerStore;
    readonly buildingId: BuildingId;
    readonly zone: RoofZoneScene;
    readonly ordinal: number;
  }) => {
    const labels = sitePlannerT.roof;
    const caption = `${labels.zoneTitle} ${ordinal} · ${labels.covers[zone.cover]}`;

    const handleSelect = useFunction((cover: RoofCover) => {
      store.setRoofCover(buildingId, zone, cover);
    });

    return (
      <div className="flex items-center gap-1.5 rounded-md border border-white/10 p-1.5">
        <Dropdown
          trigger={
            <button
              type="button"
              aria-label={caption}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-left',
                'text-[11px] text-text transition-colors duration-150 hover:bg-white/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
              )}
            >
              <span className="truncate">{caption}</span>
              <ChevronDown
                size={GLYPH_SIZE_PX}
                className="shrink-0 text-text-secondary"
                aria-hidden
              />
            </button>
          }
        >
          {ROOF_COVERS.map(cover => (
            <CoverItem
              key={cover}
              cover={cover}
              isSelected={cover === zone.cover}
              onSelect={handleSelect}
            />
          ))}
        </Dropdown>
        <span className="shrink-0 font-mono text-[10px] text-text-secondary">
          {`${zone.areaSquareMeters.toFixed(AREA_DECIMALS)} ${sitePlannerT.plan.squareMeterUnit}`}
        </span>
      </div>
    );
  }
);

const ROOF_KIND_OPTIONS = PITCHED_ROOF_KINDS.map(kind => ({
  value: kind,
  label: sitePlannerT.roof.kinds[kind],
}));

/**
 * The pitched roof over the top storey (R33): its shape, its slope, its свес
 * and which way the ridge runs. Everything else about it DERIVES — the planes,
 * the hips, the height of the ridge — so these four numbers are the whole of
 * what a person states about a roof.
 */
const PitchedRoofSection = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const labels = sitePlannerT.roof;
  const roof = store.editedPitchedRoof;
  const scene = store.editedPitchedRoofScene;

  const handleToggle = useFunction(() => store.togglePitchedRoof());
  const handleKindChange = useFunction((kind: string) => {
    const parsed = parsePitchedRoofKind(kind);

    if (!isNil(parsed)) {
      store.updatePitchedRoof({ kind: parsed });
    }
  });
  const handlePitchChange = useFunction((value: number | undefined) => {
    if (!isNil(value)) {
      store.updatePitchedRoof({
        pitchDegrees: clamp(value, MIN_ROOF_PITCH_DEGREES, MAX_ROOF_PITCH_DEGREES),
      });
    }
  });
  const handleOverhangChange = useFunction((value: number | undefined) => {
    if (!isNil(value)) {
      store.updatePitchedRoof({ overhangMeters: Math.max(0, value) });
    }
  });
  const handleRidgeChange = useFunction((value: number | undefined) => {
    if (!isNil(value)) {
      store.updatePitchedRoof({ ridgeDegrees: normalizeTurnDegrees(value) });
    }
  });

  const peakMeters =
    isNil(scene) || isNil(scene.ridgeElevation) || isNil(scene.eaveElevation)
      ? undefined
      : scene.ridgeElevation - scene.eaveElevation;

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="sm" onClick={handleToggle}>
        {isNil(roof) ? labels.addPitched : labels.removePitched}
      </Button>
      {isNil(roof) ? (
        <PanelHint>{labels.flatHint}</PanelHint>
      ) : (
        <>
          <RadioGroup options={ROOF_KIND_OPTIONS} value={roof.kind} onChange={handleKindChange} />
          <PropertyField
            label={labels.pitch}
            value={roof.pitchDegrees}
            decimal={0}
            onValueChange={handlePitchChange}
          />
          <PropertyField
            label={labels.overhang}
            value={roof.overhangMeters}
            decimal={METER_DECIMALS}
            onValueChange={handleOverhangChange}
          />
          <PropertyField
            label={labels.ridge}
            value={roof.ridgeDegrees}
            decimal={0}
            onValueChange={handleRidgeChange}
          />
          {isNil(peakMeters) ? undefined : (
            <PropertyRow label={labels.ridgeHeight}>
              <PropertyValue value={formatMeters(peakMeters, sitePlannerT.plan.meterUnit)} />
            </PropertyRow>
          )}
        </>
      )}
    </div>
  );
});

/**
 * The active storey's exposed ceiling, zoned (`building-editor.md` §5): what
 * the storey above leaves uncovered — the top storey's whole roof included —
 * each region wearing a cover: membrane, terrace, or the green roof.
 */
export const RoofPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.editedStoreyScene;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  return (
    <PlannerPanel title={sitePlannerT.roof.panelTitle}>
      <PitchedRoofSection store={store} />
      {scene.roofZones.map((zone, index) => (
        <ZoneRow
          // Regions are positional by nature: a zone IS its place in the derivation.
          // biome-ignore lint/suspicious/noArrayIndexKey: derived regions have no identity beyond their order
          key={index}
          store={store}
          buildingId={buildingId}
          zone={zone}
          ordinal={index + 1}
        />
      ))}
      {scene.roofZones.length === 0 ? (
        <PanelHint>{sitePlannerT.roof.emptyHint}</PanelHint>
      ) : undefined}
    </PlannerPanel>
  );
});
