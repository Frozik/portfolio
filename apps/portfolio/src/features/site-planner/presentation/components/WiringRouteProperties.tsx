import { cn } from '@frozik/components/components/cn';
import { isNil } from 'lodash-es';
import { Check, ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { InstallationPresetId } from '../../domain/model/installation';
import { INSTALLATION_PRESET_IDS, parseInstallationPreset } from '../../domain/model/installation';
import type { WiringLevel, WiringRoute } from '../../domain/model/wiring-routes';
import { WIRING_LEVELS } from '../../domain/model/wiring-routes';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PropertyRow } from './PropertyRow';

const GLYPH_SIZE_PX = 12;

const LEVEL_OPTIONS = WIRING_LEVELS.map(level => ({
  value: level,
  label: sitePlannerT.wiring.levels[level],
}));

const INSTALLATION_OPTIONS = INSTALLATION_PRESET_IDS.map(preset => ({
  value: preset,
  label: sitePlannerT.wiring.installations[preset],
}));

const InstallationItem = memo(
  ({
    preset,
    isSelected,
    onSelect,
  }: {
    readonly preset: InstallationPresetId;
    readonly isSelected: boolean;
    readonly onSelect: (preset: InstallationPresetId) => void;
  }) => {
    const handleSelect = useEventCallback(() => onSelect(preset));

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
        {sitePlannerT.wiring.installations[preset]}
      </DropdownItem>
    );
  }
);

/** One stretch of the selected route and how the cable is laid on it. */
const SegmentRow = observer(
  ({
    store,
    route,
    segmentIndex,
  }: {
    readonly store: SitePlannerStore;
    readonly route: WiringRoute;
    readonly segmentIndex: number;
  }) => {
    const { selection } = store;
    const buildingId = selection?.kind === 'wiringRoute' ? selection.buildingId : undefined;
    const labels = sitePlannerT.wiring;
    const current = route.segments[segmentIndex].installation;

    const handleSelect = useEventCallback((preset: InstallationPresetId) => {
      if (!isNil(buildingId) && preset !== current) {
        store.electrics.wiring.setSegmentInstallation(buildingId, route.id, segmentIndex, preset);
      }
    });

    return (
      <PropertyRow label={`${labels.segmentTitle} ${segmentIndex + 1}`} isControlStretched>
        <Dropdown
          trigger={
            <button
              type="button"
              aria-label={`${labels.installationLabel}: ${labels.installations[current]}`}
              className={cn(
                'flex min-w-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1',
                'text-[11px] text-text transition-colors duration-150 hover:bg-white/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
              )}
            >
              <span className="truncate">{labels.installations[current]}</span>
              <ChevronDown
                size={GLYPH_SIZE_PX}
                className="shrink-0 text-text-secondary"
                aria-hidden
              />
            </button>
          }
        >
          {INSTALLATION_PRESET_IDS.map(preset => (
            <InstallationItem
              key={preset}
              preset={preset}
              isSelected={preset === current}
              onSelect={handleSelect}
            />
          ))}
        </Dropdown>
      </PropertyRow>
    );
  }
);

/** A drawn route taken hold of: where it runs, and how each stretch is laid. */
export const SelectedWiringRouteProperties = observer(
  ({ store, route }: { readonly store: SitePlannerStore; readonly route: WiringRoute }) => {
    const { selection } = store;
    const buildingId = selection?.kind === 'wiringRoute' ? selection.buildingId : undefined;
    const labels = sitePlannerT.wiring;

    const handleLevelChange = useEventCallback((level: WiringLevel) => {
      if (!isNil(buildingId)) {
        store.electrics.wiring.setRouteLevel(buildingId, route.id, level);
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.levelLabel} isControlStretched>
          <RadioGroup value={route.level} options={LEVEL_OPTIONS} onChange={handleLevelChange} />
        </PropertyRow>
        {route.segments.map((_, index) => (
          <SegmentRow
            // A stretch IS its place along the route.
            // oxlint-disable-next-line react/no-array-index-key -- segments have no identity beyond their index
            key={index}
            store={store}
            route={route}
            segmentIndex={index}
          />
        ))}
        <PanelHint>{labels.routeHint}</PanelHint>
      </div>
    );
  }
);

/** The route tool's settings: how the next route is laid. */
export const RouteToolProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const labels = sitePlannerT.wiring;

  const handleChange = useEventCallback((value: string) => {
    const preset = parseInstallationPreset(value);

    if (!isNil(preset)) {
      store.electrics.wiring.setArmedInstallation(preset);
    }
  });

  return (
    <div className="flex flex-col gap-2">
      <PropertyRow label={labels.installationLabel} isControlStretched>
        <RadioGroup
          value={store.electrics.wiring.armedInstallation}
          options={INSTALLATION_OPTIONS}
          onChange={handleChange}
        />
      </PropertyRow>
      <PanelHint>{labels.toolHint}</PanelHint>
    </div>
  );
});
