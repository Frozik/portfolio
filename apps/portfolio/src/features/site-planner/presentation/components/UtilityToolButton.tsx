import { useFunction } from '@frozik/components/hooks/useFunction';
import { Waypoints } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { UTILITY_SYSTEM_COLORS } from '../../application/render/plan-draw/draw-house';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { UtilitySystem } from '../../domain/model/foundation';
import { TRENCH_SYSTEMS } from '../../domain/model/routing';
import { TOOL_ICON_SIZE_PX, UTILITY_TOOL } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';
import { TOOL_HOTKEYS } from './toolHotkeys';

/** A system in the flyout is its colour first — the letter era of the plan. */
const SystemDot = ({ system }: { readonly system: UtilitySystem }) => (
  <span
    className="inline-block size-2.5 rounded-full"
    style={{ backgroundColor: UTILITY_SYSTEM_COLORS[system] }}
  />
);

const SYSTEM_GROUPS: readonly FlyoutVariantGroup<UtilitySystem>[] = [
  {
    key: 'systems',
    title: sitePlannerT.tools.systemGroup,
    variants: TRENCH_SYSTEMS.map(system => ({
      key: system,
      label: sitePlannerT.utilities.systems[system],
      icon: <SystemDot system={system} />,
      value: system,
    })),
  },
];

/**
 * The palette's trench tool: one button armed with a system, and the flyout to
 * arm it from — the placed-object button's pattern, systems for species.
 */
export const UtilityToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armedSystem = store.nextUtilitySystem;

    const handleActivate = useFunction(() => store.setActiveTool(UTILITY_TOOL));

    const handleChoose = useFunction((system: UtilitySystem) => {
      store.setNextUtilitySystem(system);
      store.setActiveTool(UTILITY_TOOL);
    });

    const label = `${sitePlannerT.tools.utility} (${TOOL_HOTKEYS[UTILITY_TOOL]})`;

    return (
      <FlyoutToolButton
        title={`${label} · ${sitePlannerT.utilities.systems[armedSystem]}`}
        menuLabel={sitePlannerT.tools.utilityMenu}
        icon={
          <Waypoints
            size={TOOL_ICON_SIZE_PX}
            color={UTILITY_SYSTEM_COLORS[armedSystem]}
            aria-hidden
          />
        }
        isActive={store.activeTool === UTILITY_TOOL}
        side={side}
        armedKey={armedSystem}
        groups={SYSTEM_GROUPS}
        onActivate={handleActivate}
        onChoose={handleChoose}
      />
    );
  }
);
