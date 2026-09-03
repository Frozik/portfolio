import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { OverlayMode } from '../../domain/view/overlay-mode';
import { sitePlannerT } from '../translations';

interface OverlayModeOption {
  readonly value: OverlayMode;
  readonly label: string;
}

const PLAN_OVERLAY_OPTIONS: readonly OverlayModeOption[] = [
  { value: 'none', label: sitePlannerT.analysis.none },
  { value: 'slope', label: sitePlannerT.analysis.slope },
  { value: 'cut-fill', label: sitePlannerT.analysis.cutFill },
];

/** Cut/fill is an earthworks readout — it only makes sense on the plan. */
const SCENE_OVERLAY_OPTIONS: readonly OverlayModeOption[] = PLAN_OVERLAY_OPTIONS.filter(
  option => option.value !== 'cut-fill'
);

const OverlayModeButton = memo(
  ({
    option,
    isActive,
    onSelect,
  }: {
    readonly option: OverlayModeOption;
    readonly isActive: boolean;
    readonly onSelect: (overlayMode: OverlayMode) => void;
  }) => {
    const handleClick = useFunction(() => onSelect(option.value));

    return (
      <button
        type="button"
        aria-pressed={isActive}
        onClick={handleClick}
        className={cn(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isActive ? 'bg-brand-500 text-white' : 'text-text-secondary hover:bg-white/10'
        )}
      >
        {option.label}
      </button>
    );
  }
);

/**
 * Which analysis is coloured over the ground. Slope applies to both views —
 * they take the same raster — while cut/fill stays a plan-only readout, so the
 * 3D view offers only the options it can honour.
 */
export const OverlayModeToggle = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <fieldset className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
    <legend className="sr-only">{sitePlannerT.analysis.groupLabel}</legend>
    {(store.viewMode === 'scene' ? SCENE_OVERLAY_OPTIONS : PLAN_OVERLAY_OPTIONS).map(option => (
      <OverlayModeButton
        key={option.value}
        option={option}
        isActive={option.value === store.overlayMode}
        onSelect={store.setOverlayMode}
      />
    ))}
  </fieldset>
));
