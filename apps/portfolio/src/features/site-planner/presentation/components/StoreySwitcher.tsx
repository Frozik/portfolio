import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import { storeysOf } from '../../domain/model/site-plan';
import type { StoreyId } from '../../domain/model/storeys';
import { sitePlannerT } from '../translations';

const GLYPH_SIZE_PX = 12;

const StoreyButton = memo(
  ({
    storeyId,
    ordinal,
    isActive,
    onSelect,
  }: {
    readonly storeyId: StoreyId;
    readonly ordinal: number;
    readonly isActive: boolean;
    readonly onSelect: (storeyId: StoreyId) => void;
  }) => {
    const handleClick = useFunction(() => onSelect(storeyId));
    const title = `${sitePlannerT.storeys.storeyTitle} ${ordinal}`;

    return (
      <button
        type="button"
        aria-label={title}
        aria-pressed={isActive}
        title={title}
        onClick={handleClick}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-medium',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isActive ? 'bg-brand-500 text-white' : 'text-brand-500 hover:bg-brand-500/20'
        )}
      >
        {ordinal}
      </button>
    );
  }
);

/**
 * The first `MODE_BAR_EXTRAS` occupant (`building-editor.md` §5): one button
 * per storey, a way to raise the next one — empty, or from a copy of the walls
 * below — the reference-display eye, and a way to take an upper storey down.
 */
export const StoreySwitcher = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const building = store.buildings.find(candidate => candidate.id === buildingId);
  const labels = sitePlannerT.storeys;

  const handleSelect = useFunction((storeyId: StoreyId) => store.setActiveStorey(storeyId));
  const handleAddEmpty = useFunction(() => store.addStoreyToEditedBuilding({ copyWalls: false }));
  const handleAddCopy = useFunction(() => store.addStoreyToEditedBuilding({ copyWalls: true }));
  const handleToggleReference = useFunction(() => store.toggleReferenceStorey());
  const handleRemove = useFunction(() => {
    const activeStoreyId = store.activeStoreyId;

    if (!isNil(activeStoreyId)) {
      store.removeStoreyFromEdited(activeStoreyId);
    }
  });

  if (isNil(building)) {
    return null;
  }

  const storeys = storeysOf(building);
  const activeStoreyId = store.activeStoreyId;
  const activeLevel = storeys.findIndex(storey => storey.id === activeStoreyId);
  const isUpperActive = activeLevel > 0;

  return (
    <div className="flex items-center gap-0.5">
      {storeys.map((storey, index) => (
        <StoreyButton
          key={storey.id}
          storeyId={storey.id}
          ordinal={index + 1}
          isActive={storey.id === activeStoreyId}
          onSelect={handleSelect}
        />
      ))}
      <Dropdown
        trigger={
          <button
            type="button"
            aria-label={labels.add}
            title={labels.add}
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md text-brand-500',
              'transition-colors duration-150 hover:bg-brand-500/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
            )}
          >
            <Plus size={GLYPH_SIZE_PX} aria-hidden />
          </button>
        }
      >
        <DropdownItem onSelect={handleAddEmpty} className="gap-2 py-1.5 text-xs">
          <Plus size={GLYPH_SIZE_PX} className="shrink-0" aria-hidden />
          {labels.addEmpty}
        </DropdownItem>
        <DropdownItem onSelect={handleAddCopy} className="gap-2 py-1.5 text-xs">
          <Copy size={GLYPH_SIZE_PX} className="shrink-0" aria-hidden />
          {labels.addCopy}
        </DropdownItem>
      </Dropdown>
      {isUpperActive ? (
        <>
          <button
            type="button"
            aria-label={labels.referenceToggle}
            aria-pressed={store.isReferenceStoreyVisible}
            title={labels.referenceToggle}
            onClick={handleToggleReference}
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md text-brand-500',
              'transition-colors duration-150 hover:bg-brand-500/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
            )}
          >
            {store.isReferenceStoreyVisible ? (
              <Eye size={GLYPH_SIZE_PX} aria-hidden />
            ) : (
              <EyeOff size={GLYPH_SIZE_PX} aria-hidden />
            )}
          </button>
          <button
            type="button"
            aria-label={labels.remove}
            title={labels.remove}
            onClick={handleRemove}
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md text-brand-500',
              'transition-colors duration-150 hover:bg-brand-500/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
            )}
          >
            <Trash2 size={GLYPH_SIZE_PX} aria-hidden />
          </button>
        </>
      ) : undefined}
    </div>
  );
});
