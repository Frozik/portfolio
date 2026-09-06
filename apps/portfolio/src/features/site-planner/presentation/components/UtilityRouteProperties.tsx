import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { PencilRuler } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedUtilityRouteId } from '../../domain/model/editor-mode';
import type { UtilityRoute } from '../../domain/model/routing';
import {
  parseTrenchSystem,
  routeDiameterMeters,
  routeLengthMeters,
  TRENCH_SYSTEMS,
} from '../../domain/model/routing';
import { EDIT_ICON_SIZE_PX, METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PropertyField } from './PropertyField';
import { PropertyRow, PropertyValue } from './PropertyRow';

const TRENCH_SYSTEM_OPTIONS = TRENCH_SYSTEMS.map(system => ({
  value: system,
  label: sitePlannerT.utilities.systems[system],
}));

/** Burial figures are read to the centimetre; the digging is not finer. */
const TRENCH_DEPTH_DECIMALS = 2;

/** The Russian convention quotes a sewer's fall in centimetres per metre. */
const SLOPE_CM_PER_METER = 100;

const SLOPE_DECIMALS = 1;

/**
 * A drawn trench: the system is data, and everything below grade reads back
 * derived — length, burial range and a sewer's slope come from the norms
 * against the terrain, so only the system and a sewer's bore are typed.
 */
export const SelectedUtilityRouteProperties = observer(
  ({ store, route }: { readonly store: SitePlannerStore; readonly route: UtilityRoute }) => {
    const labels = sitePlannerT.utilities;
    const profile = store.utilities.trenchProfiles.get(route.id);
    const isEditingThisRoute = editedUtilityRouteId(store.editorMode) === route.id;

    const handleSystemChange = useFunction((value: string) => {
      const system = parseTrenchSystem(value);

      if (!isNil(system)) {
        store.utilities.setUtilityRouteSystem(route.id, system);
      }
    });
    const handleDiameterChange = useFunction((value: number | undefined) => {
      if (!isNil(value) && value > 0) {
        store.utilities.setUtilityRouteDiameter(route.id, value);
      }
    });
    const handleEnterEditMode = useFunction(() =>
      store.modes.openEditorDoor({
        target: { kind: 'utilityRoute', routeId: route.id },
        aimAt: undefined,
      })
    );

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.systemLabel} isControlStretched>
          <RadioGroup
            value={route.system}
            options={TRENCH_SYSTEM_OPTIONS}
            onChange={handleSystemChange}
          />
        </PropertyRow>
        {route.system === 'sewer' ? (
          <PropertyField
            label={labels.diameter}
            value={routeDiameterMeters(route)}
            decimal={METER_DECIMALS}
            onValueChange={handleDiameterChange}
          />
        ) : undefined}
        <PropertyRow label={labels.length}>
          <PropertyValue
            value={formatMeters(routeLengthMeters(route.points), sitePlannerT.plan.meterUnit)}
          />
        </PropertyRow>
        {isNil(profile) ? undefined : (
          <PropertyRow label={labels.depthRange}>
            <PropertyValue
              value={`${profile.minDepthMeters.toFixed(TRENCH_DEPTH_DECIMALS)}–${profile.maxDepthMeters.toFixed(TRENCH_DEPTH_DECIMALS)} ${sitePlannerT.plan.meterUnit}`}
            />
          </PropertyRow>
        )}
        {isNil(profile?.slope) ? undefined : (
          <PropertyRow label={labels.slope}>
            <PropertyValue
              value={`${(profile.slope * SLOPE_CM_PER_METER).toFixed(SLOPE_DECIMALS)} ${labels.slopeUnit}`}
            />
          </PropertyRow>
        )}
        {isEditingThisRoute ? (
          <PanelHint>{labels.pointsHint}</PanelHint>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleEnterEditMode}>
            <PencilRuler size={EDIT_ICON_SIZE_PX} aria-hidden />
            {sitePlannerT.modes.editRoute}
          </Button>
        )}
      </div>
    );
  }
);

/** With the trench tool in hand, the panel is where the system is armed. */
export const UtilityToolProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const labels = sitePlannerT.utilities;

  const handleSystemChange = useFunction((value: string) => {
    const system = parseTrenchSystem(value);

    if (!isNil(system)) {
      store.utilities.setNextUtilitySystem(system);
    }
  });

  return (
    <div className="flex flex-col gap-2">
      <PropertyRow label={labels.systemLabel} isControlStretched>
        <RadioGroup
          value={store.utilities.nextUtilitySystem}
          options={TRENCH_SYSTEM_OPTIONS}
          onChange={handleSystemChange}
        />
      </PropertyRow>
      <PanelHint>{sitePlannerT.status.hints.utility}</PanelHint>
    </div>
  );
});
