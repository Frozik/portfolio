import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { Eye, EyeOff } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingLayerId } from '../../domain/model/building-layers';
import { sitePlannerT } from '../translations';

const EYE_SIZE_PX = 12;

/**
 * The eye beside a layer's row. The active layer's eye is disabled rather than
 * hidden: what cannot be seen cannot be worked in (`layers.md` §7 п.2), and a
 * disabled eye says so where the finger already is.
 */
export const LayerEye = observer(
  ({ store, layer }: { readonly store: SitePlannerStore; readonly layer: BuildingLayerId }) => {
    const isVisible = store.layers.isLayerVisible(layer);
    const canToggle = store.layers.canToggleLayerVisibility(layer);
    const labels = sitePlannerT.layers;
    const title = canToggle ? (isVisible ? labels.hide : labels.show) : labels.activeAlwaysVisible;

    const handleToggle = useFunction(() => store.layers.toggleLayerVisibility(layer));

    return (
      <button
        type="button"
        aria-label={title}
        aria-pressed={isVisible}
        title={title}
        disabled={!canToggle}
        onClick={handleToggle}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isVisible ? 'text-text-secondary hover:text-text' : 'text-text-muted hover:text-text',
          'disabled:cursor-default disabled:text-text-muted/50 disabled:hover:text-text-muted/50'
        )}
      >
        {isVisible ? (
          <Eye size={EYE_SIZE_PX} aria-hidden />
        ) : (
          <EyeOff size={EYE_SIZE_PX} aria-hidden />
        )}
      </button>
    );
  }
);
