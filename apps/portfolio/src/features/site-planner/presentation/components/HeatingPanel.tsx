import { isNil } from 'lodash-es';
import { RotateCw, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import type { ObjectRow } from './ObjectListPanel';
import { ObjectListPanel } from './ObjectListPanel';

/**
 * The fires standing on the active storey (R34). Each one's flue is derived —
 * placed behind the firebox, carried through every storey above and taken out
 * over the roof at the height СП 7.13130 asks for — so the row states where it
 * comes out rather than offering it for editing.
 */
export const HeatingPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.editedStoreyScene;
  const labels = sitePlannerT.heating;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  const rows: readonly ObjectRow[] = scene.fireplaces.map(({ fireplace }) => {
    const topElevation = store.ductTopElevationOf(fireplace.id);

    return {
      key: fireplace.id,
      label: labels.kinds[fireplace.kind],
      note: isNil(topElevation)
        ? undefined
        : formatMeters(topElevation, sitePlannerT.plan.meterUnit, METER_DECIMALS),
      isSelected: store.isSelected({ kind: 'fireplace', buildingId, fireplaceId: fireplace.id }),
      onSelect: () =>
        store.setSelection({ kind: 'fireplace', buildingId, fireplaceId: fireplace.id }),
      actions: [
        {
          key: 'rotate',
          label: labels.rotate,
          icon: RotateCw,
          onClick: () => store.rotateFireplaceByQuarter(buildingId, fireplace.id),
        },
        {
          key: 'remove',
          label: labels.remove,
          icon: Trash2,
          onClick: () => store.removeFireplaceFrom(buildingId, fireplace.id),
        },
      ],
    };
  });

  return <ObjectListPanel title={labels.panelTitle} rows={rows} emptyHint={labels.emptyHint} />;
});
