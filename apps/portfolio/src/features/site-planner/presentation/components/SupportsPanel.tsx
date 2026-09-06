import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import type { ObjectRow } from './ObjectListPanel';
import { ObjectListPanel } from './ObjectListPanel';

/**
 * The posts standing on the active storey. A post's length is DERIVED — floor
 * or graded ground below, the storey's ceiling above — so the row states it
 * rather than offering it for editing: on a slope the posts of one canopy are
 * honestly different lengths.
 */
export const SupportsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.storeys.editedStoreyScene;
  const labels = sitePlannerT.supports;
  const { meterUnit } = sitePlannerT.plan;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  const rows: readonly ObjectRow[] = scene.supports.map((supportScene, index) => {
    const { baseElevation, topElevation, post } = supportScene;
    const lengthMeters =
      isNil(baseElevation) || isNil(topElevation) ? undefined : topElevation - baseElevation;

    return {
      key: post.id,
      label: `${index + 1}. ${labels.toolLabel}`,
      note: isNil(lengthMeters) ? undefined : formatMeters(lengthMeters, meterUnit, METER_DECIMALS),
      isSelected: store.selectionCommands.isSelected({
        kind: 'support',
        buildingId,
        supportId: post.id,
      }),
      onSelect: () => store.setSelection({ kind: 'support', buildingId, supportId: post.id }),
      actions: [
        {
          key: 'remove',
          label: labels.remove,
          icon: Trash2,
          onClick: () => store.storeyObjects.removeSupportFrom(buildingId, post.id),
        },
      ],
    };
  });

  return <ObjectListPanel title={labels.panelTitle} rows={rows} emptyHint={labels.emptyHint} />;
});
