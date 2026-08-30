import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { MapPin } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent, ReactNode } from 'react';
import { lazy, memo, Suspense, useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { Drawer } from '../../../../shared/ui/Drawer';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import { Spinner } from '../../../../shared/ui/Spinner';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { SiteLocationChanges } from '../../domain/model/site-plan-edits';
import { formatMeters } from '../../domain/plan-draw/shared';
import { isValidTimeZoneId } from '../../domain/sun/time-zone';
import type { Meters } from '../../domain/units';
import type { PlanLayerKind } from '../../domain/view/plan-layers';
import { PLAN_LAYER_KINDS } from '../../domain/view/plan-layers';
import { COORDINATE_DECIMALS, METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { CompassSettings } from './CompassPanel';
import { PanelHint } from './PanelHint';
import { PropertyField } from './PropertyField';

/** Steps a plan is normally drawn on: a decimetre, a quarter, a half, a metre. */
const GRID_STEP_OPTIONS: readonly Meters[] = [0.1, 0.25, 0.5, 1];

/** Sampling grids of the terrain: half the resolution for a quarter of the work. */
const HEIGHTFIELD_RESOLUTION_OPTIONS: readonly number[] = [128, 256];

const RESOLUTION_SEPARATOR = ' × ';

const MAP_BUTTON_ICON_SIZE_PX = 13;

const GRID_STEP_HISTORY_GROUP = 'settings:grid-step';
const SETBACK_HISTORY_GROUP = 'settings:setback';
const CONTOUR_INTERVAL_HISTORY_GROUP = 'settings:contour-interval';
const FROST_DEPTH_HISTORY_GROUP = 'settings:frost-depth';
const LATITUDE_HISTORY_GROUP = 'settings:latitude';
const LONGITUDE_HISTORY_GROUP = 'settings:longitude';
const TIME_ZONE_HISTORY_GROUP = 'settings:time-zone';
const LOCATION_MAP_HISTORY_GROUP = 'settings:location-map';

/**
 * Leaflet and its tile styling are a third of the feature's own weight and are
 * of no use until someone asks for the map, so the dialog is a chunk of its own,
 * fetched on the first open.
 */
const LocationMapDialog = lazy(() =>
  import('./LocationMapDialog').then(module => ({ default: module.LocationMapDialog }))
);

const GRID_STEP_CHOICES = GRID_STEP_OPTIONS.map(step => ({
  value: String(step),
  label: formatMeters(step, sitePlannerT.plan.meterUnit),
}));

const RESOLUTION_CHOICES = HEIGHTFIELD_RESOLUTION_OPTIONS.map(resolution => ({
  value: String(resolution),
  label: `${resolution}${RESOLUTION_SEPARATOR}${resolution}`,
}));

const SettingsSection = memo(
  ({ title, children }: { readonly title: string; readonly children: ReactNode }) => (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary">
        {title}
      </h3>
      {children}
    </section>
  )
);

const CheckboxRow = memo(
  ({
    label,
    isChecked,
    onToggle,
  }: {
    readonly label: string;
    readonly isChecked: boolean;
    readonly onToggle: VoidFunction;
  }) => (
    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-text-secondary">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        className="size-4 accent-brand-500"
      />
      {label}
    </label>
  )
);

const GridSection = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const handleStepChange = useFunction((value: string) => {
    const step = GRID_STEP_OPTIONS.find(candidate => String(candidate) === value);

    if (!isNil(step)) {
      store.updateSettings({ gridStepMeters: step }, GRID_STEP_HISTORY_GROUP);
    }
  });
  const handleSnapToggle = useFunction(() =>
    store.updateSettings({ isSnapEnabled: !store.settings.isSnapEnabled })
  );

  return (
    <SettingsSection title={sitePlannerT.settings.grid.title}>
      <span className="text-[11px] text-text-secondary">{sitePlannerT.settings.grid.step}</span>
      <RadioGroup
        options={GRID_STEP_CHOICES}
        value={String(store.settings.gridStepMeters)}
        onChange={handleStepChange}
        optionType="button"
        className="text-xs"
      />
      <CheckboxRow
        label={sitePlannerT.settings.grid.snap}
        isChecked={store.settings.isSnapEnabled}
        onToggle={handleSnapToggle}
      />
    </SettingsSection>
  );
});

const TerrainSection = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const handleSetbackChange = useFunction((value: number | undefined) => {
    if (!isNil(value)) {
      store.updateSettings({ setbackMeters: value }, SETBACK_HISTORY_GROUP);
    }
  });
  const handleContourIntervalChange = useFunction((value: number | undefined) => {
    if (!isNil(value) && value > 0) {
      store.updateSettings({ contourIntervalMeters: value }, CONTOUR_INTERVAL_HISTORY_GROUP);
    }
  });
  const handleFrostDepthChange = useFunction((value: number | undefined) => {
    if (!isNil(value) && value > 0) {
      store.updateSettings({ frostDepthMeters: value }, FROST_DEPTH_HISTORY_GROUP);
    }
  });
  const handleResolutionChange = useFunction((value: string) => {
    const resolution = HEIGHTFIELD_RESOLUTION_OPTIONS.find(
      candidate => String(candidate) === value
    );

    if (!isNil(resolution)) {
      store.updateSettings({ heightfieldTargetResolution: resolution });
    }
  });

  return (
    <SettingsSection title={sitePlannerT.settings.terrain.title}>
      <PropertyField
        label={sitePlannerT.settings.terrain.setback}
        value={store.settings.setbackMeters}
        decimal={METER_DECIMALS}
        onValueChange={handleSetbackChange}
      />
      <PropertyField
        label={sitePlannerT.settings.terrain.contourInterval}
        value={store.settings.contourIntervalMeters}
        decimal={METER_DECIMALS}
        onValueChange={handleContourIntervalChange}
      />
      <PropertyField
        label={sitePlannerT.settings.terrain.frostDepth}
        value={store.frostDepthMeters}
        decimal={METER_DECIMALS}
        onValueChange={handleFrostDepthChange}
      />
      <span className="text-[11px] text-text-secondary">
        {sitePlannerT.settings.terrain.resolution}
      </span>
      <RadioGroup
        options={RESOLUTION_CHOICES}
        value={String(store.settings.heightfieldTargetResolution)}
        onChange={handleResolutionChange}
        optionType="button"
        className="text-xs"
      />
    </SettingsSection>
  );
});

/**
 * The time zone is typed rather than picked: the IANA list is the platform's and
 * runs to hundreds of names. A name the runtime cannot resolve is kept in the
 * field and marked, so a half-typed zone never reaches the sun study.
 */
const TimeZoneField = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const [rejectedDraft, setRejectedDraft] = useState<string | undefined>(undefined);
  const value = rejectedDraft ?? store.settings.location.timeZoneId;

  const handleChange = useFunction((event: ChangeEvent<HTMLInputElement>) => {
    const nextTimeZoneId = event.target.value;

    if (isValidTimeZoneId(nextTimeZoneId)) {
      setRejectedDraft(undefined);
      store.updateSettings({ location: { timeZoneId: nextTimeZoneId } }, TIME_ZONE_HISTORY_GROUP);

      return;
    }

    setRejectedDraft(nextTimeZoneId);
  });

  return (
    <div className="flex flex-col gap-1">
      {/* The row is a label rather than a `PropertyRow`: the control is a real
          input, and wrapping it is what names it without an id of its own. */}
      <label className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-text-secondary">
          {sitePlannerT.settings.location.timeZone}
        </span>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          spellCheck={false}
          className={cn(
            'min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1',
            'font-mono text-[11px] text-text focus:outline-none',
            isNil(rejectedDraft)
              ? 'border-white/10 focus:border-brand-500'
              : 'border-error focus:border-error'
          )}
        />
      </label>
      {isNil(rejectedDraft) ? undefined : (
        <p role="alert" className="text-[11px] text-error">
          {sitePlannerT.settings.location.unknownTimeZone}
        </p>
      )}
    </div>
  );
});

const LocationSection = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { location } = store.settings;
  const [isMapOpen, setIsMapOpen] = useState(false);

  const handleLatitudeChange = useFunction((value: number | undefined) => {
    if (!isNil(value)) {
      store.updateSettings({ location: { latitudeDegrees: value } }, LATITUDE_HISTORY_GROUP);
    }
  });
  const handleLongitudeChange = useFunction((value: number | undefined) => {
    if (!isNil(value)) {
      store.updateSettings({ location: { longitudeDegrees: value } }, LONGITUDE_HISTORY_GROUP);
    }
  });
  const handleMapOpen = useFunction(() => setIsMapOpen(true));
  const handleMapClose = useFunction(() => setIsMapOpen(false));

  /**
   * The picked place reaches the plan as one settings edit, so the coordinates
   * and the time zone that came with them are a single step to undo.
   */
  const handleMapApply = useFunction((picked: SiteLocationChanges) => {
    store.updateSettings({ location: picked }, LOCATION_MAP_HISTORY_GROUP);
  });

  return (
    <SettingsSection title={sitePlannerT.settings.location.title}>
      <PropertyField
        label={sitePlannerT.settings.location.latitude}
        value={location.latitudeDegrees}
        decimal={COORDINATE_DECIMALS}
        allowNegative
        onValueChange={handleLatitudeChange}
      />
      <PropertyField
        label={sitePlannerT.settings.location.longitude}
        value={location.longitudeDegrees}
        decimal={COORDINATE_DECIMALS}
        allowNegative
        onValueChange={handleLongitudeChange}
      />
      <TimeZoneField store={store} />
      <Button variant="secondary" size="sm" onClick={handleMapOpen}>
        <MapPin size={MAP_BUTTON_ICON_SIZE_PX} />
        {sitePlannerT.settings.location.pickOnMap}
      </Button>
      <PanelHint>{sitePlannerT.settings.location.mapHint}</PanelHint>
      {isMapOpen && (
        <Suspense fallback={<Spinner size="sm" />}>
          <LocationMapDialog
            initialLatitudeDegrees={location.latitudeDegrees}
            initialLongitudeDegrees={location.longitudeDegrees}
            onApply={handleMapApply}
            onClose={handleMapClose}
          />
        </Suspense>
      )}
    </SettingsSection>
  );
});

const LayerRow = observer(
  ({ store, layer }: { readonly store: SitePlannerStore; readonly layer: PlanLayerKind }) => {
    const handleToggle = useFunction(() => store.toggleLayerVisibility(layer));

    return (
      <CheckboxRow
        label={sitePlannerT.settings.layers.kinds[layer]}
        isChecked={store.visibleLayers.has(layer)}
        onToggle={handleToggle}
      />
    );
  }
);

/**
 * What the sheet shows. It filters the drawing rather than the document, so it
 * applies to the plan on screen and to an exported PNG alike, and hiding a layer
 * leaves nothing to undo.
 */
const LayersSection = memo(({ store }: { readonly store: SitePlannerStore }) => (
  <SettingsSection title={sitePlannerT.settings.layers.title}>
    <div className="flex flex-col gap-1.5">
      {PLAN_LAYER_KINDS.map(layer => (
        <LayerRow key={layer} store={store} layer={layer} />
      ))}
    </div>
  </SettingsSection>
));

/**
 * Everything about the plan that is not its geometry: the grid it snaps to, the
 * distances derived from it, where on Earth it lies, and which of its layers are
 * drawn. Opened from the toolbar's ⚙, as a drawer — it is a panel of settings to
 * work alongside, not a dialog to answer and dismiss.
 */
export const SettingsPanel = memo(
  ({
    store,
    open,
    onClose,
  }: {
    readonly store: SitePlannerStore;
    readonly open: boolean;
    readonly onClose: VoidFunction;
  }) => (
    <Drawer title={sitePlannerT.settings.title} open={open} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <GridSection store={store} />
        <TerrainSection store={store} />
        <LocationSection store={store} />
        <SettingsSection title={sitePlannerT.compass.title}>
          <CompassSettings store={store} />
        </SettingsSection>
        <LayersSection store={store} />
      </div>
    </Drawer>
  )
);
