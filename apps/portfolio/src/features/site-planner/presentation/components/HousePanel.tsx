import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Check, ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { memo } from 'react';
import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import type { BuildingScene } from '../../application/building-scene';
import { formatCubicMeters, formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { PadElevationMode } from '../../domain/model/building';
import { PAD_ELEVATION_MODES, padDropOf } from '../../domain/model/building';
import type { FoundationKind } from '../../domain/model/foundation';
import { FOUNDATION_KINDS } from '../../domain/model/foundation';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PlannerPanel } from './PlannerPanel';
import { PropertyField } from './PropertyField';
import { PropertyRow, PropertyValue } from './PropertyRow';
import { EntriesBlock } from './UtilityEntriesBlock';

const GLYPH_SIZE_PX = 12;
/** Joins the caption of the pad menu to the mode it stands on, for its name. */
const TRIGGER_LABEL_SEPARATOR = ': ';

/**
 * One mode in the menu. The tick marks the mode in force rather than a colour
 * alone: colour is the one cue a reader may not have.
 */
const PadModeItem = memo(
  ({
    mode,
    isSelected,
    onSelect,
  }: {
    readonly mode: PadElevationMode;
    readonly isSelected: boolean;
    readonly onSelect: (mode: PadElevationMode) => void;
  }) => {
    const handleSelect = useFunction(() => onSelect(mode));

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
        {sitePlannerT.house.padModes[mode]}
      </DropdownItem>
    );
  }
);

/**
 * Where a building's pad takes its level from. A menu rather than a list of
 * radios: four options, each of them a phrase, would otherwise cost the card
 * more height than everything else in it put together.
 */
const PadModeSelect = observer(
  ({ store, scene }: { readonly store: SitePlannerStore; readonly scene: BuildingScene }) => {
    const { building } = scene;
    const { padModeLabel, padModes } = sitePlannerT.house;
    const currentLabel = padModes[building.padElevationMode];

    const handleSelect = useFunction((mode: PadElevationMode) => {
      store.building.setPadElevationMode(building.id, mode);
    });

    return (
      <PropertyRow label={padModeLabel} isControlStretched>
        <Dropdown
          trigger={
            // The caption stands beside the button rather than in it, so the name
            // carries both: without the mode, the button announces what it is for
            // and never what it is set to.
            <button
              type="button"
              aria-label={`${padModeLabel}${TRIGGER_LABEL_SEPARATOR}${currentLabel}`}
              title={currentLabel}
              className={cn(
                'flex min-w-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1',
                'text-[11px] text-text transition-colors duration-150 hover:bg-white/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
              )}
            >
              <span className="truncate">{currentLabel}</span>
              <ChevronDown
                size={GLYPH_SIZE_PX}
                className="shrink-0 text-text-secondary"
                aria-hidden
              />
            </button>
          }
        >
          {PAD_ELEVATION_MODES.map(mode => (
            <PadModeItem
              key={mode}
              mode={mode}
              isSelected={mode === building.padElevationMode}
              onSelect={handleSelect}
            />
          ))}
        </Dropdown>
      </PropertyRow>
    );
  }
);

/**
 * How much soil a building's pad costs — warm for what has to come away, cool
 * for what has to be brought in, the convention every earthworks report
 * follows. The overlay legend shows the very same figures over the ground.
 * The foundation's concrete joins the report: it is the same excavation bill.
 */
const EarthworksReport = memo(({ scene }: { readonly scene: BuildingScene }) => {
  const report = scene.cutFill;

  if (isNil(report)) {
    return undefined;
  }

  const { cubicMeterUnit, earthworks, cut, fill, foundation } = sitePlannerT.house;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-white/10 p-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary">
        {earthworks}
      </span>
      <PropertyRow label={cut}>
        <PropertyValue
          value={formatCubicMeters(report.cutVolumeCubicMeters, cubicMeterUnit)}
          className="text-landing-red"
        />
      </PropertyRow>
      <PropertyRow label={fill}>
        <PropertyValue
          value={formatCubicMeters(report.fillVolumeCubicMeters, cubicMeterUnit)}
          className="text-landing-green"
        />
      </PropertyRow>
      <PropertyRow label={foundation.volume}>
        <PropertyValue
          value={
            isNil(scene.foundationVolumeCubicMeters)
              ? foundation.volumeNotEstimated
              : formatCubicMeters(scene.foundationVolumeCubicMeters, cubicMeterUnit)
          }
        />
      </PropertyRow>
    </div>
  );
});

const FoundationKindItem = memo(
  ({
    kind,
    isSelected,
    onSelect,
  }: {
    readonly kind: FoundationKind;
    readonly isSelected: boolean;
    readonly onSelect: (kind: FoundationKind) => void;
  }) => {
    const handleSelect = useFunction(() => onSelect(kind));

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
        {sitePlannerT.house.foundation.kinds[kind]}
      </DropdownItem>
    );
  }
);

/**
 * The foundation: chosen, never drawn —
 * kind plus two numbers, with the geometry derived from the footprint.
 */
const FoundationBlock = observer(
  ({ store, scene }: { readonly store: SitePlannerStore; readonly scene: BuildingScene }) => {
    const { building, foundation } = scene;
    const labels = sitePlannerT.house.foundation;
    const currentLabel = labels.kinds[foundation.kind];

    const handleKindSelect = useFunction((kind: FoundationKind) => {
      store.building.updateFoundation(building.id, { kind });
    });
    const handleDepthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.building.updateFoundation(building.id, { depthMeters: value });
      }
    });
    const handlePlinthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.building.updateFoundation(building.id, { heightAboveGroundMeters: value });
      }
    });

    return (
      <div className="flex flex-col gap-1 rounded-lg border border-white/10 p-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary">
          {labels.title}
        </span>
        <PropertyRow label={labels.kindLabel} isControlStretched>
          <Dropdown
            trigger={
              <button
                type="button"
                aria-label={`${labels.kindLabel}${TRIGGER_LABEL_SEPARATOR}${currentLabel}`}
                title={currentLabel}
                className={cn(
                  'flex min-w-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1',
                  'text-[11px] text-text transition-colors duration-150 hover:bg-white/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                )}
              >
                <span className="truncate">{currentLabel}</span>
                <ChevronDown
                  size={GLYPH_SIZE_PX}
                  className="shrink-0 text-text-secondary"
                  aria-hidden
                />
              </button>
            }
          >
            {FOUNDATION_KINDS.map(kind => (
              <FoundationKindItem
                key={kind}
                kind={kind}
                isSelected={kind === foundation.kind}
                onSelect={handleKindSelect}
              />
            ))}
          </Dropdown>
        </PropertyRow>
        <PropertyField
          label={labels.depth}
          value={foundation.depthMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleDepthChange}
        />
        <PropertyField
          label={labels.plinth}
          value={foundation.heightAboveGroundMeters}
          decimal={METER_DECIMALS}
          onValueChange={handlePlinthChange}
        />
      </div>
    );
  }
);

/**
 * One building as a whole, rather than any one shape of its footprint: what
 * level it stands on, how tall its walls are, and what levelling the ground
 * onto that pad costs. The shapes themselves stay in the structure panel and
 * the properties panel next to it.
 */
const BuildingBlock = observer(
  ({ store, scene }: { readonly store: SitePlannerStore; readonly scene: BuildingScene }) => {
    const { building, padElevation } = scene;

    const handleManualPadChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.building.setManualPadElevation(building.id, value);
      }
    });
    const handlePadDropChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.building.setPadDrop(building.id, value);
      }
    });
    const handleWallHeightChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.building.setWallHeight(building.id, value);
      }
    });
    const handleNameChange = useFunction((event: ChangeEvent<HTMLInputElement>) => {
      store.building.renameBuilding(building.id, event.target.value);
    });

    const { meterUnit } = sitePlannerT.plan;

    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 p-2">
        <input
          type="text"
          value={building.name}
          aria-label={sitePlannerT.house.nameLabel}
          onChange={handleNameChange}
          className={cn(
            'w-full rounded-md bg-transparent px-1 py-0.5 text-xs font-medium text-text',
            'border border-transparent transition-colors duration-150',
            'hover:border-white/10 focus:border-brand-500 focus:outline-none'
          )}
        />

        <PadModeSelect store={store} scene={scene} />

        {building.padElevationMode === 'manual' ? (
          // The terrain modes derive the pad, so there is nothing to type into
          // them: the number is shown as a readout until the mode makes it an input.
          <PropertyField
            label={sitePlannerT.house.padElevation}
            value={building.manualPadElevation ?? padElevation ?? 0}
            decimal={METER_DECIMALS}
            allowNegative
            onValueChange={handleManualPadChange}
          />
        ) : (
          <>
            <PropertyRow label={sitePlannerT.house.padElevation}>
              <PropertyValue
                value={isNil(padElevation) ? '' : formatMeters(padElevation, meterUnit)}
              />
            </PropertyRow>
            <PropertyField
              label={sitePlannerT.house.padDrop}
              value={padDropOf(building)}
              decimal={METER_DECIMALS}
              onValueChange={handlePadDropChange}
            />
          </>
        )}

        <PropertyField
          label={sitePlannerT.house.wallHeight}
          value={building.wallHeight}
          decimal={METER_DECIMALS}
          onValueChange={handleWallHeightChange}
        />

        <FoundationBlock store={store} scene={scene} />
        <EntriesBlock store={store} scene={scene} />
        <EarthworksReport scene={scene} />
      </div>
    );
  }
);

/** Every structure on the plot, each with its own pad, walls and earthworks. */
export const BuildingsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const scenes = store.scene.buildingScenes;

  if (scenes.length === 0) {
    return undefined;
  }

  return (
    <PlannerPanel title={sitePlannerT.house.title}>
      {scenes.map(scene => (
        <BuildingBlock key={scene.building.id} store={store} scene={scene} />
      ))}
    </PlannerPanel>
  );
});
