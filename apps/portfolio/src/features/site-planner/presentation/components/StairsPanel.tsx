import { isNil } from 'lodash-es';
import { FlipHorizontal2, RotateCw, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import type { ObjectRow } from './ObjectListPanel';
import { ObjectListPanel } from './ObjectListPanel';

/**
 * The stairs standing on the active storey, each climbing to the one above.
 * A row states what the model DERIVED from the storey height — steps, riser
 * and tread — because those three numbers are what a person actually wants to
 * know about a stair, and showing them is what makes the automatic run
 * trustworthy rather than mysterious.
 */
export const StairsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.editedStoreyScene;
  const labels = sitePlannerT.stairs;
  const { meterUnit } = sitePlannerT.plan;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  const rows: readonly ObjectRow[] = scene.stairs.map((stairScene, index) => {
    const { stair, run } = stairScene;

    return {
      key: stair.id,
      label: `${index + 1}. ${labels.kinds[stair.kind]}`,
      detail: `${run.riserCount} · ${labels.riser} ${formatMeters(run.riserMeters, meterUnit, METER_DECIMALS)} · ${labels.tread} ${formatMeters(run.treadMeters, meterUnit, METER_DECIMALS)}`,
      warning: stairScene.isComfortable ? undefined : labels.uncomfortable,
      isSelected: store.isSelected({ kind: 'stair', buildingId, stairId: stair.id }),
      onSelect: () => store.setSelection({ kind: 'stair', buildingId, stairId: stair.id }),
      actions: [
        {
          key: 'rotate',
          label: labels.rotate,
          icon: RotateCw,
          onClick: () => store.rotateStairByQuarter(buildingId, stair.id),
        },
        {
          key: 'mirror',
          label: labels.mirror,
          icon: FlipHorizontal2,
          onClick: () => store.mirrorStair(buildingId, stair.id),
        },
        {
          key: 'remove',
          label: labels.remove,
          icon: Trash2,
          onClick: () => store.removeStairFrom(buildingId, stair.id),
        },
      ],
    };
  });

  return <ObjectListPanel title={labels.panelTitle} rows={rows} emptyHint={labels.emptyHint} />;
});
