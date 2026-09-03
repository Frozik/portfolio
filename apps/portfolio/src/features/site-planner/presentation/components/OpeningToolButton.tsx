import { useFunction } from '@frozik/components/hooks/useFunction';
import { DoorOpen } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { OBJECT_EDITOR_SPECS } from '../../domain/model/editor-mode';
import type { OpeningPreset } from '../../domain/model/openings';
import { OPENING_PRESETS } from '../../domain/model/openings';
import { TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';

const VARIANT_ICON_SIZE_PX = 12;

const PRESET_GROUPS: readonly FlyoutVariantGroup<OpeningPreset>[] = [
  {
    key: 'openings',
    title: sitePlannerT.openings.panelTitle,
    variants: OPENING_PRESETS.map(preset => ({
      key: preset,
      label: sitePlannerT.openings.presets[preset],
      icon: <DoorOpen size={VARIANT_ICON_SIZE_PX} aria-hidden />,
      value: preset,
    })),
  },
];

const TOOL_HOTKEY =
  OBJECT_EDITOR_SPECS.building.ownTools
    .find(tool => tool.id === 'building:opening')
    ?.hotkey?.toUpperCase() ?? '';

/**
 * The rail's opening tool with its presets attached. They used to be reachable
 * only through the properties panel, which put a door and a window behind a
 * scroll — every other catalogue tool here arms itself from the rail, and an
 * opening is a catalogue object like the rest.
 */
export const OpeningToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armedPreset = store.walls.armedOpeningPreset;

    const handleActivate = useFunction(() => store.setActiveTool('building:opening'));

    const handleChoose = useFunction((preset: OpeningPreset) => {
      store.walls.setArmedOpeningPreset(preset);
      store.setActiveTool('building:opening');
    });

    const label = `${sitePlannerT.openings.toolLabel} (${TOOL_HOTKEY})`;

    return (
      <FlyoutToolButton
        title={`${label} · ${sitePlannerT.openings.presets[armedPreset]}`}
        menuLabel={sitePlannerT.openings.menu}
        icon={<DoorOpen size={TOOL_ICON_SIZE_PX} aria-hidden />}
        isActive={store.activeTool === 'building:opening'}
        side={side}
        armedKey={armedPreset}
        groups={PRESET_GROUPS}
        onActivate={handleActivate}
        onChoose={handleChoose}
      />
    );
  }
);
