import { isNil } from 'lodash-es';
import { RotateCw, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { multiPolygonArea } from '../../domain/geometry/building-outline';
import { slabPolygon } from '../../domain/geometry/slab-geometry';
import { editedBuildingId } from '../../domain/model/editor-mode';
import { isBoxedShape } from '../../domain/model/shapes';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import type { ObjectRow, ObjectRowAction } from './ObjectListPanel';
import { ObjectListPanel } from './ObjectListPanel';

/**
 * The floor of the active storey. A storey with slabs takes its outline from
 * them — which is what lets an upper floor hang past the one below and still
 * be walked on (R24, R28) — and its walls are then held inside that outline.
 * The exact size is typed in СВОЙСТВА, where every shape on the plan is typed.
 */
export const SlabsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const labels = sitePlannerT.slabs;

  if (isNil(buildingId)) {
    return null;
  }

  const rows: readonly ObjectRow[] = store.storeyObjects.activeStoreySlabs.map((slab, index) => {
    const turn: readonly ObjectRowAction[] = isBoxedShape(slab)
      ? [
          {
            key: 'rotate',
            label: labels.rotate,
            icon: RotateCw,
            onClick: () => store.storeyObjects.rotateSlabByQuarter(buildingId, slab.id),
          },
        ]
      : [];

    return {
      key: slab.id,
      label: `${index + 1}. ${labels.kinds[slab.kind]}`,
      note: `${multiPolygonArea([slabPolygon(slab)]).toFixed(METER_DECIMALS)} ${sitePlannerT.plan.squareMeterUnit}`,
      isSelected: store.selectionCommands.isSelected({ kind: 'slab', buildingId, slabId: slab.id }),
      onSelect: () => store.setSelection({ kind: 'slab', buildingId, slabId: slab.id }),
      actions: [
        ...turn,
        {
          key: 'remove',
          label: labels.remove,
          icon: Trash2,
          onClick: () => store.storeyObjects.removeSlabFrom(buildingId, slab.id),
        },
      ],
    };
  });

  return <ObjectListPanel title={labels.panelTitle} rows={rows} emptyHint={labels.emptyHint} />;
});
