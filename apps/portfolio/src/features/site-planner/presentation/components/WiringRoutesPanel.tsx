import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { polylineLength } from '../../domain/geometry/wall-geometry';
import { editedBuildingId } from '../../domain/model/editor-mode';
import { wiringRoutesOf } from '../../domain/model/storeys';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import type { ObjectRow } from './ObjectListPanel';
import { ObjectListPanel } from './ObjectListPanel';

/** The drawn cable routes of the active storey: each named, measured, removable. */
export const WiringRoutesPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.storeys.editedStoreyScene;
  const labels = sitePlannerT.wiring;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  const rows: readonly ObjectRow[] = wiringRoutesOf(scene.storey).map((route, index) => {
    const selection = { kind: 'wiringRoute', buildingId, routeId: route.id } as const;
    const methods = [...new Set(route.segments.map(segment => segment.installation))];

    return {
      key: route.id,
      label: `${labels.routeTitle} ${index + 1} · ${labels.levels[route.level]}`,
      detail: methods.map(method => labels.installations[method]).join(' · '),
      note: formatMeters(polylineLength(route.points), sitePlannerT.plan.meterUnit, METER_DECIMALS),
      isSelected: store.selectionCommands.isSelected(selection),
      onSelect: () => store.setSelection(selection),
      actions: [
        {
          key: 'remove',
          label: labels.remove,
          icon: Trash2,
          onClick: () => store.storeyObjects.removeSelectedStoreyObject(selection),
        },
      ],
    };
  });

  return (
    <ObjectListPanel
      title={labels.routesPanelTitle}
      rows={rows}
      emptyHint={labels.routesEmptyHint}
    />
  );
});
