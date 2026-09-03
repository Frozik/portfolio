import { useFunction } from '@frozik/components/hooks/useFunction';
import { Footprints } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { OBJECT_EDITOR_SPECS } from '../../domain/model/editor-mode';
import type { StairKind } from '../../domain/model/stairs';
import { STAIR_KINDS } from '../../domain/model/stairs';
import { TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';

const VARIANT_ICON_SIZE_PX = 12;

const KIND_GROUPS: readonly FlyoutVariantGroup<StairKind>[] = [
  {
    key: 'stairs',
    title: sitePlannerT.stairs.panelTitle,
    variants: STAIR_KINDS.map(kind => ({
      key: kind,
      label: sitePlannerT.stairs.kinds[kind],
      icon: <Footprints size={VARIANT_ICON_SIZE_PX} aria-hidden />,
      value: kind,
    })),
  },
];

const TOOL_HOTKEY =
  OBJECT_EDITOR_SPECS.building.ownTools
    .find(tool => tool.id === 'building:stair')
    ?.hotkey?.toUpperCase() ?? '';

/**
 * The rail's stair tool: the kind it is armed with, and the flyout to change
 * it — the same catalogue-then-place gesture as furniture, because a stair IS
 * a catalogue object here (the Sweet Home 3D model), not a drawing mode.
 */
export const StairToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armedKind = store.storeyObjects.armedStairKind;

    const handleActivate = useFunction(() => store.setActiveTool('building:stair'));

    const handleChoose = useFunction((kind: StairKind) => {
      store.storeyObjects.setArmedStairKind(kind);
      store.setActiveTool('building:stair');
    });

    const label = `${sitePlannerT.stairs.toolLabel} (${TOOL_HOTKEY})`;

    return (
      <FlyoutToolButton
        title={`${label} · ${sitePlannerT.stairs.kinds[armedKind]}`}
        menuLabel={sitePlannerT.stairs.menu}
        icon={<Footprints size={TOOL_ICON_SIZE_PX} aria-hidden />}
        isActive={store.activeTool === 'building:stair'}
        side={side}
        armedKey={armedKind}
        groups={KIND_GROUPS}
        onActivate={handleActivate}
        onChoose={handleChoose}
      />
    );
  }
);
