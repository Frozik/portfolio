import { useFunction } from '@frozik/components/hooks/useFunction';
import { Spline } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { OBJECT_EDITOR_SPECS } from '../../domain/model/editor-mode';
import type { InstallationPresetId } from '../../domain/model/installation';
import { INSTALLATION_PRESET_IDS } from '../../domain/model/installation';
import { FLYOUT_ICON_SIZE_PX, TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';

const INSTALLATION_GROUPS: readonly FlyoutVariantGroup<InstallationPresetId>[] = [
  {
    key: 'installations',
    title: sitePlannerT.wiring.installationLabel,
    variants: INSTALLATION_PRESET_IDS.map(preset => ({
      key: preset,
      label: sitePlannerT.wiring.installations[preset],
      icon: <Spline size={FLYOUT_ICON_SIZE_PX} aria-hidden />,
      value: preset,
    })),
  },
];

const TOOL_HOTKEY =
  OBJECT_EDITOR_SPECS.building.ownTools
    .find(tool => tool.id === 'building:route')
    ?.hotkey?.toUpperCase() ?? '';

/**
 * The rail's route tool (`wiring.md` §3.3): one button armed with how the
 * cable is laid — a conduit of some bore, a chase, trunking — and the flyout
 * to arm it from, the trench tool's pattern with methods for systems.
 */
export const RouteToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armed = store.electrics.wiring.armedInstallation;

    const handleActivate = useFunction(() => store.setActiveTool('building:route'));
    const handleChoose = useFunction((preset: InstallationPresetId) => {
      store.electrics.wiring.setArmedInstallation(preset);
      store.setActiveTool('building:route');
    });

    const label = `${sitePlannerT.wiring.toolLabel} (${TOOL_HOTKEY})`;

    return (
      <FlyoutToolButton
        title={`${label} · ${sitePlannerT.wiring.installations[armed]}`}
        menuLabel={sitePlannerT.wiring.menu}
        icon={<Spline size={TOOL_ICON_SIZE_PX} aria-hidden />}
        isActive={store.activeTool === 'building:route'}
        side={side}
        armedKey={armed}
        groups={INSTALLATION_GROUPS}
        onActivate={handleActivate}
        onChoose={handleChoose}
      />
    );
  }
);
