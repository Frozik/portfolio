import { useFunction } from '@frozik/components/hooks/useFunction';
import { Flame } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { OBJECT_EDITOR_SPECS } from '../../domain/model/editor-mode';
import type { FireplaceKind } from '../../domain/model/fireplaces';
import { FIREPLACE_KINDS } from '../../domain/model/fireplaces';
import { TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';

const VARIANT_ICON_SIZE_PX = 12;

const KIND_GROUPS: readonly FlyoutVariantGroup<FireplaceKind>[] = [
  {
    key: 'fireplaces',
    title: sitePlannerT.heating.panelTitle,
    variants: FIREPLACE_KINDS.map(kind => ({
      key: kind,
      label: sitePlannerT.heating.kinds[kind],
      icon: <Flame size={VARIANT_ICON_SIZE_PX} aria-hidden />,
      value: kind,
    })),
  },
];

const TOOL_HOTKEY =
  OBJECT_EDITOR_SPECS.building.ownTools
    .find(tool => tool.id === 'building:fireplace')
    ?.hotkey?.toUpperCase() ?? '';

/**
 * The rail's fire tool: which of the three it is armed with, and the flyout to
 * change it — the catalogue-then-place gesture furniture and stairs already
 * use, because a stove is picked from a catalogue exactly as they are.
 */
export const FireplaceToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armedKind = store.ducts.armedFireplaceKind;

    const handleActivate = useFunction(() => store.setActiveTool('building:fireplace'));

    const handleChoose = useFunction((kind: FireplaceKind) => {
      store.ducts.setArmedFireplaceKind(kind);
      store.setActiveTool('building:fireplace');
    });

    const label = `${sitePlannerT.heating.toolLabel} (${TOOL_HOTKEY})`;

    return (
      <FlyoutToolButton
        title={`${label} · ${sitePlannerT.heating.kinds[armedKind]}`}
        menuLabel={sitePlannerT.heating.menu}
        icon={<Flame size={TOOL_ICON_SIZE_PX} aria-hidden />}
        isActive={store.activeTool === 'building:fireplace'}
        side={side}
        armedKey={armedKind}
        groups={KIND_GROUPS}
        onActivate={handleActivate}
        onChoose={handleChoose}
      />
    );
  }
);
