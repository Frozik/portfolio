import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { memo } from 'react';

import type { SitePlannerViewMode } from '../../domain/view/view-mode';
import { sitePlannerT } from '../translations';

interface ViewModeOption {
  readonly value: SitePlannerViewMode;
  readonly label: string;
}

const VIEW_MODE_OPTIONS: readonly ViewModeOption[] = [
  { value: 'plan', label: sitePlannerT.viewMode.plan },
  { value: 'scene', label: sitePlannerT.viewMode.scene },
];

const ViewModeButton = memo(
  ({
    option,
    isActive,
    onSelect,
  }: {
    readonly option: ViewModeOption;
    readonly isActive: boolean;
    readonly onSelect: (viewMode: SitePlannerViewMode) => void;
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

export const ViewModeToggle = memo(
  ({
    viewMode,
    onChange,
  }: {
    readonly viewMode: SitePlannerViewMode;
    readonly onChange: (viewMode: SitePlannerViewMode) => void;
  }) => (
    <fieldset className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
      <legend className="sr-only">{sitePlannerT.viewMode.groupLabel}</legend>
      {VIEW_MODE_OPTIONS.map(option => (
        <ViewModeButton
          key={option.value}
          option={option}
          isActive={option.value === viewMode}
          onSelect={onChange}
        />
      ))}
    </fieldset>
  )
);
