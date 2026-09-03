import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import type { ObjectRow, ObjectRowAction } from './ObjectListPanel';
import { ObjectListPanel } from './ObjectListPanel';

/**
 * Every shaft crossing the active storey (R35): the ones planted on it, and
 * the flues and vents rising through it from below. A shaft that only PASSES
 * THROUGH is listed too and cannot be removed from here — it belongs to the
 * floor it starts on, and seeing it is the whole reason the list exists: the
 * chimney in the middle of the bedroom upstairs is a thing to plan around.
 */
export const VentilationPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.editedStoreyScene;
  const labels = sitePlannerT.ventilation;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  const rows: readonly ObjectRow[] = scene.ducts.map(section => {
    const { duct } = section;
    const isOwn = section.startsHere && isNil(section.fireplaceId);
    const topElevation = store.ductTopElevationOf(duct.id);
    const actions: readonly ObjectRowAction[] = isOwn
      ? [
          {
            key: 'remove',
            label: labels.remove,
            icon: Trash2,
            onClick: () => store.removeDuctFrom(buildingId, duct.id),
          },
        ]
      : [];

    return {
      key: duct.id,
      label: `${labels.kinds[duct.kind]} · ${section.startsHere ? labels.startsHere : labels.passingThrough}`,
      note: isNil(topElevation)
        ? undefined
        : formatMeters(topElevation, sitePlannerT.plan.meterUnit, METER_DECIMALS),
      isSelected: store.isSelected({ kind: 'duct', buildingId, ductId: duct.id }),
      onSelect: isOwn
        ? () => store.setSelection({ kind: 'duct', buildingId, ductId: duct.id })
        : undefined,
      actions,
    };
  });

  return <ObjectListPanel title={labels.panelTitle} rows={rows} emptyHint={labels.emptyHint} />;
});
