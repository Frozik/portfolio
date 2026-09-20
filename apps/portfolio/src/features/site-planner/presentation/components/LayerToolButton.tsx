import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { EyeOff, Layers } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingLayerId } from '../../domain/model/building-layers';
import { BUILDING_LAYER_IDS } from '../../domain/model/building-layers';
import { FLYOUT_ICON_SIZE_PX, TOOL_ICON_SIZE_PX } from '../constants';
import { sitePlannerT } from '../translations';
import { LAYER_PRESENTATIONS } from './editorTools';
import type { FlyoutSide, FlyoutVariantGroup } from './FlyoutToolButton';
import { FlyoutToolButton } from './FlyoutToolButton';
import { LayerEye } from './LayerEye';

/** What a row of the layer menu chooses: a layer to work in, or a sweep of the eyes. */
type LayerMenuChoice =
  | { readonly kind: 'layer'; readonly layer: BuildingLayerId }
  | { readonly kind: 'hide-others' }
  | { readonly kind: 'show-all' };

/** A layer's glyph with how many objects it holds on the storey in view. */
const LayerRowIcon = memo(
  ({ layer, count }: { readonly layer: BuildingLayerId; readonly count: number }) => {
    const { icon: Icon } = LAYER_PRESENTATIONS[layer];

    return (
      <span className="relative flex items-center justify-center">
        <Icon size={FLYOUT_ICON_SIZE_PX} aria-hidden />
        {count > 0 ? (
          <span className="absolute -right-2 -top-1.5 font-mono text-[9px] text-text-muted">
            {count}
          </span>
        ) : undefined}
      </span>
    );
  }
);

/**
 * The rail's layer button (`layers.md` §8.1): it wears the active layer's
 * glyph, and its list — the body and the corner triangle both open it — is
 * the one place the layers are switched and shown or hidden. It stands on the
 * rail rather than in the side column because the column is a drawer on a
 * narrow screen, and switching the layer is the most frequent move there is.
 */
export const LayerToolButton = observer(
  ({ store, side }: { readonly store: SitePlannerStore; readonly side: FlyoutSide }) => {
    const activeLayer = store.layers.activeLayer;
    const labels = sitePlannerT.layers;
    const counts = store.layers.objectCounts;

    const handleChoose = useEventCallback((choice: LayerMenuChoice) => {
      switch (choice.kind) {
        case 'layer':
          store.layers.setActiveLayer(choice.layer);

          return;
        case 'hide-others':
          store.layers.hideOtherLayers();

          return;
        case 'show-all':
          store.layers.showAllLayers();

          return;
        default:
          assertNever(choice);
      }
    });

    if (isNil(activeLayer)) {
      return null;
    }

    const { icon: ActiveIcon, label } = LAYER_PRESENTATIONS[activeLayer];
    const groups: readonly FlyoutVariantGroup<LayerMenuChoice>[] = [
      {
        key: 'layers',
        variants: BUILDING_LAYER_IDS.map(layer => ({
          key: layer,
          label: LAYER_PRESENTATIONS[layer].label,
          icon: <LayerRowIcon layer={layer} count={counts[layer]} />,
          value: { kind: 'layer', layer },
          trailing: <LayerEye store={store} layer={layer} />,
        })),
      },
      {
        key: 'visibility',
        variants: [
          {
            key: 'hide-others',
            label: labels.hideOthers,
            icon: <EyeOff size={FLYOUT_ICON_SIZE_PX} aria-hidden />,
            value: { kind: 'hide-others' },
          },
          {
            key: 'show-all',
            label: labels.showAll,
            icon: <Layers size={FLYOUT_ICON_SIZE_PX} aria-hidden />,
            value: { kind: 'show-all' },
          },
        ],
      },
    ];

    return (
      <FlyoutToolButton<LayerMenuChoice>
        title={`${labels.toolTitle}: ${label} · ${labels.cycleHint}`}
        menuLabel={labels.menu}
        icon={<ActiveIcon size={TOOL_ICON_SIZE_PX} aria-hidden />}
        isActive={false}
        side={side}
        armedKey={activeLayer}
        groups={groups}
        onChoose={handleChoose}
      />
    );
  }
);
