import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { PlacedObject } from '../../domain/model/placed-object';
import { PLACED_OBJECT_CATALOG, placedObjectKey } from '../../domain/model/placed-object';
import { FLYOUT_ICON_SIZE_PX, PLACED_OBJECT_TOOL, TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import type { FlyoutSide, FlyoutVariant, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';
import { PlacedObjectIcon } from './PlacedObjectIcon';
import { describePlacedObject } from './placedObjectLabel';
import { TOOL_HOTKEYS } from './toolHotkeys';

function toVariants(objects: readonly PlacedObject[]): readonly FlyoutVariant<PlacedObject>[] {
  return objects.map(object => ({
    key: placedObjectKey(object),
    label: describePlacedObject(object),
    icon: (
      <PlacedObjectIcon object={object} width={FLYOUT_ICON_SIZE_PX} height={FLYOUT_ICON_SIZE_PX} />
    ),
    value: object,
  }));
}

/** The catalogue split by kind, so the flyout can head each run of it. */
const PLACED_OBJECT_GROUPS: readonly FlyoutVariantGroup<PlacedObject>[] = [
  {
    key: 'trees',
    title: sitePlannerT.tools.treeGroup,
    variants: toVariants(PLACED_OBJECT_CATALOG.filter(object => object.kind === 'tree')),
  },
  {
    key: 'cars',
    title: sitePlannerT.tools.carGroup,
    variants: toVariants(PLACED_OBJECT_CATALOG.filter(object => object.kind === 'car')),
  },
];

/**
 * The palette's placing tool: one button wearing whatever it is armed with, and a
 * flyout to arm it from — five buttons of the same tool would crowd the rail, and
 * the thing being placed is what the user is looking for anyway.
 */
export const PlacedObjectToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const armedObject = store.nextPlacedObject;

    const handleActivate = useFunction(() => store.setActiveTool(PLACED_OBJECT_TOOL));

    const handleChoose = useFunction((object: PlacedObject) => {
      store.setNextPlacedObject(object);
      store.setActiveTool(PLACED_OBJECT_TOOL);
    });

    const label = `${sitePlannerT.tools.tree} (${TOOL_HOTKEYS[PLACED_OBJECT_TOOL]})`;

    return (
      <FlyoutToolButton
        title={`${label} · ${describePlacedObject(armedObject)}`}
        menuLabel={sitePlannerT.tools.placedObjectMenu}
        icon={
          <PlacedObjectIcon
            object={armedObject}
            width={TOOL_ICON_SIZE_PX}
            height={TOOL_ICON_SIZE_PX}
          />
        }
        isActive={store.activeTool === PLACED_OBJECT_TOOL}
        side={side}
        armedKey={placedObjectKey(armedObject)}
        groups={PLACED_OBJECT_GROUPS}
        onActivate={handleActivate}
        onChoose={handleChoose}
      />
    );
  }
);
