import { useFunction } from '@frozik/components/hooks/useFunction';
import type { LucideIcon } from 'lucide-react';
import { Lightbulb, Plug, ToggleLeft, Zap } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { OBJECT_EDITOR_SPECS } from '../../domain/model/editor-mode';
import type { DeviceKind } from '../../domain/model/electrical';
import { DEVICE_KINDS } from '../../domain/model/electrical';
import { FLYOUT_ICON_SIZE_PX, TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';

const KIND_ICONS: Readonly<Record<DeviceKind, LucideIcon>> = {
  panel: Zap,
  outlet: Plug,
  switch: ToggleLeft,
  light: Lightbulb,
};

const KIND_GROUPS: readonly FlyoutVariantGroup<DeviceKind>[] = [
  {
    key: 'kinds',
    title: sitePlannerT.electrical.panelTitle,
    variants: DEVICE_KINDS.map(kind => {
      const Icon = KIND_ICONS[kind];

      return {
        key: kind,
        label: sitePlannerT.electrical.kinds[kind],
        icon: <Icon size={FLYOUT_ICON_SIZE_PX} aria-hidden />,
        value: kind,
      };
    }),
  },
];

const TOOL_HOTKEY =
  OBJECT_EDITOR_SPECS.building.ownTools
    .find(tool => tool.id === 'building:electric')
    ?.hotkey?.toUpperCase() ?? '';

/**
 * The rail's electric tool: one button armed with a device kind, the flyout
 * to arm it from — щиток, розетка, выключатель or светильник a click away.
 */
export const ElectricToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armedKind = store.storeyObjects.armedDeviceKind;
    const ArmedIcon = KIND_ICONS[armedKind];

    const handleActivate = useFunction(() => store.setActiveTool('building:electric'));

    const handleChoose = useFunction((kind: DeviceKind) => {
      store.storeyObjects.setArmedDeviceKind(kind);
      store.setActiveTool('building:electric');
    });

    const label = `${sitePlannerT.electrical.toolLabel} (${TOOL_HOTKEY})`;

    return (
      <FlyoutToolButton
        title={`${label} · ${sitePlannerT.electrical.kinds[armedKind]}`}
        menuLabel={sitePlannerT.tools.electricMenu}
        icon={<ArmedIcon size={TOOL_ICON_SIZE_PX} aria-hidden />}
        isActive={store.activeTool === 'building:electric'}
        side={side}
        armedKey={armedKind}
        groups={KIND_GROUPS}
        onActivate={handleActivate}
        onChoose={handleChoose}
      />
    );
  }
);
