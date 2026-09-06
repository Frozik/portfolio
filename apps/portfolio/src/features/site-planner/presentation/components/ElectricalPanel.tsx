import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingId } from '../../domain/model/building';
import { editedBuildingId } from '../../domain/model/editor-mode';
import type { ElectricalDevice } from '../../domain/model/electrical';
import { groupsOf, switchLinksOf } from '../../domain/model/storeys';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const GLYPH_SIZE_PX = 12;

/** One placed device's row: named by kind, removable. */
const DeviceRow = memo(
  ({
    store,
    buildingId,
    device,
    ordinal,
  }: {
    readonly store: SitePlannerStore;
    readonly buildingId: BuildingId;
    readonly device: ElectricalDevice;
    readonly ordinal: number;
  }) => {
    const handleSelect = useFunction(() => {
      store.setSelection({ kind: 'device', buildingId, deviceId: device.id });
    });
    const handleRemove = useFunction(() => {
      store.electrics.removeDevice(buildingId, device.id);
    });

    return (
      <div className="flex items-center gap-1.5 rounded-md border border-white/10 p-1.5">
        <button
          type="button"
          onClick={handleSelect}
          className={cn(
            'min-w-0 flex-1 truncate text-left text-[11px] text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
          )}
        >
          {`${sitePlannerT.electrical.kinds[device.kind]} ${ordinal}`}
        </button>
        <button
          type="button"
          aria-label={sitePlannerT.electrical.remove}
          title={sitePlannerT.electrical.remove}
          onClick={handleRemove}
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md',
            'text-text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
          )}
        >
          <Trash2 size={GLYPH_SIZE_PX} aria-hidden />
        </button>
      </div>
    );
  }
);

/**
 * The active storey's electrics: the kind tiles arm
 * the placing tool, the list reads back what stands where, and the summary
 * counts every группа and switch link the connect tool has wired.
 */
export const ElectricalPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.storeys.editedStoreyScene;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  const labels = sitePlannerT.electrical;
  const storey = scene.storey;
  const devices = storey.devices ?? [];
  const groups = groupsOf(storey);
  const links = switchLinksOf(storey);

  return (
    <PlannerPanel title={labels.panelTitle}>
      {devices.map((device, index) => (
        <DeviceRow
          key={device.id}
          store={store}
          buildingId={buildingId}
          device={device}
          ordinal={index + 1}
        />
      ))}
      {groups.length > 0 || links.length > 0 ? (
        <span className="font-mono text-[10px] text-text-secondary">
          {`${labels.groupsSummary}: ${groups.length} · ${labels.linksSummary}: ${links.length}`}
        </span>
      ) : undefined}
      <PanelHint>{devices.length === 0 ? labels.emptyHint : labels.hint}</PanelHint>
    </PlannerPanel>
  );
});
