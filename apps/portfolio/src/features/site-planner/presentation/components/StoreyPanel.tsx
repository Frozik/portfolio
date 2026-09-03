import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { floorToFloorMeters } from '../../domain/geometry/storey-plates';
import { editedBuildingId } from '../../domain/model/editor-mode';
import type { Meters } from '../../domain/units';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PlannerPanel } from './PlannerPanel';
import { PropertyField } from './PropertyField';
import { PropertyRow, PropertyValue } from './PropertyRow';

/** The «±0.000» convention: floor levels read relative to the ground floor. */
function formatRelativeLevel(value: Meters, meterUnit: string): string {
  const sign = value >= 0 ? '+' : '';

  return `${sign}${formatMeters(value, meterUnit, METER_DECIMALS)}`;
}

/**
 * The active storey's own numbers (`building-editor.md` §5, plan §6.6): its
 * editable height, and the derived floor levels — relative to the ground
 * floor's ±0.000 and absolute over the site datum. Lives in the properties
 * panels, deliberately NOT in the mode bar.
 */
export const StoreyPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.editedStoreyScene;
  const buildingScene = store.buildingScenes.find(
    candidate => candidate.building.id === buildingId
  );
  const labels = sitePlannerT.storeys;
  const { meterUnit } = sitePlannerT.plan;

  const handleHeightChange = useFunction((heightMeters: number | undefined) => {
    if (!isNil(scene) && !isNil(heightMeters)) {
      store.setStoreyHeightOnEdited(scene.storey.id, heightMeters as Meters);
    }
  });

  if (isNil(buildingId) || isNil(scene) || isNil(buildingScene)) {
    return null;
  }

  const groundElevation = buildingScene.storeys[0]?.baseElevation;

  return (
    <PlannerPanel title={`${labels.panelTitle} ${scene.level + 1}`}>
      <PropertyField
        label={labels.height}
        value={scene.storey.heightMeters}
        decimal={METER_DECIMALS}
        onValueChange={handleHeightChange}
      />
      {!isNil(scene.baseElevation) && !isNil(groundElevation) ? (
        <PropertyRow label={labels.floorLevel}>
          <PropertyValue
            value={formatRelativeLevel(scene.baseElevation - groundElevation, meterUnit)}
          />
        </PropertyRow>
      ) : undefined}
      <PropertyRow label={labels.floorToFloor}>
        <PropertyValue
          value={formatMeters(
            floorToFloorMeters(scene.storey.heightMeters),
            meterUnit,
            METER_DECIMALS
          )}
        />
      </PropertyRow>
      {!isNil(scene.baseElevation) && !isNil(buildingScene.padElevation) ? (
        <PropertyRow label={labels.floorAboveGround}>
          <PropertyValue
            value={formatMeters(
              scene.baseElevation - buildingScene.padElevation,
              meterUnit,
              METER_DECIMALS
            )}
          />
        </PropertyRow>
      ) : undefined}
    </PlannerPanel>
  );
});
