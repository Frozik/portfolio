import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Check, ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import type { RoofZoneScene, SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import type { BuildingId } from '../../domain/model/site-plan';
import type { RoofCover } from '../../domain/model/storeys';
import { ROOF_COVERS } from '../../domain/model/storeys';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

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
