import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Check, ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedPathId } from '../../domain/model/editor-mode';
import type { PathSurface, SitePath } from '../../domain/model/site-plan';
import { PATH_SURFACES, pathSurfaceAt } from '../../domain/model/site-plan';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';
import { PropertyField } from './PropertyField';
import { PropertyRow } from './PropertyRow';

const GLYPH_SIZE_PX = 12;

const SurfaceItem = memo(
  ({
    surface,
    isSelected,
    onSelect,
  }: {
    readonly surface: PathSurface;
    readonly isSelected: boolean;
    readonly onSelect: (surface: PathSurface) => void;
  }) => {
    const handleSelect = useFunction(() => onSelect(surface));

    return (
      <DropdownItem
        onSelect={handleSelect}
        className={cn('gap-2 py-1.5 text-xs', isSelected && 'text-brand-500')}
      >
        <Check
          size={GLYPH_SIZE_PX}
          className={cn('shrink-0', !isSelected && 'invisible')}
          aria-hidden
        />
        {sitePlannerT.segments.surfaces[surface]}
      </DropdownItem>
    );
  }
);

/**
 * One stretch of the path between two bends: how wide it starts, how wide it
 * ends — the widths ARE the two shared points, so a neighbouring segment picks
 * the change up at the seam — and what it is paved with.
 */
const SegmentBlock = observer(
  ({
    store,
    path,
    segmentIndex,
  }: {
    readonly store: SitePlannerStore;
    readonly path: SitePath;
    readonly segmentIndex: number;
  }) => {
    const start = path.points[segmentIndex];
    const end = path.points[segmentIndex + 1];
    const surface = pathSurfaceAt(start);
    const { surfaceLabel, surfaces, startWidth, endWidth, title } = sitePlannerT.segments;
    const currentLabel = surfaces[surface];

    const handleStartWidthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.pushHistory(`${path.id}:point:${segmentIndex}:width`);
        store.setPathPointWidth(path.id, segmentIndex, value);
      }
    });
    const handleEndWidthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.pushHistory(`${path.id}:point:${segmentIndex + 1}:width`);
        store.setPathPointWidth(path.id, segmentIndex + 1, value);
      }
    });
    const handleSurfaceSelect = useFunction((next: PathSurface) => {
      if (next !== surface) {
        store.setPathSegmentSurface(path.id, segmentIndex, next);
      }
    });
    const handlePointerEnter = useFunction(() => store.setHoveredPathSegmentIndex(segmentIndex));
    const handlePointerLeave = useFunction(() => store.setHoveredPathSegmentIndex(undefined));

    return (
      <div
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className="flex flex-col gap-1.5 rounded-lg border border-white/10 p-2 transition-colors duration-150 hover:border-brand-500/50"
      >
        <PropertyRow label={`${title} ${segmentIndex + 1}`} isControlStretched>
          <Dropdown
            trigger={
              <button
                type="button"
                aria-label={`${surfaceLabel}: ${currentLabel}`}
                title={currentLabel}
                className={cn(
                  'flex min-w-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1',
                  'text-[11px] text-text transition-colors duration-150 hover:bg-white/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                )}
              >
                <span className="truncate">{currentLabel}</span>
                <ChevronDown
                  size={GLYPH_SIZE_PX}
                  className="shrink-0 text-text-secondary"
                  aria-hidden
                />
              </button>
            }
          >
            {PATH_SURFACES.map(candidate => (
              <SurfaceItem
                key={candidate}
                surface={candidate}
                isSelected={candidate === surface}
                onSelect={handleSurfaceSelect}
              />
            ))}
          </Dropdown>
        </PropertyRow>
        <PropertyField
          label={startWidth}
          value={start.width}
          decimal={METER_DECIMALS}
          onValueChange={handleStartWidthChange}
        />
        <PropertyField
          label={endWidth}
          value={end.width}
          decimal={METER_DECIMALS}
          onValueChange={handleEndWidthChange}
        />
      </div>
    );
  }
);

/**
 * Path editing's segment inventory: every stretch between two bends with its
 * own widths and paving. The widths at a shared bend appear in both of its
 * segments on purpose — that IS the shared point, and editing either row edits
 * the same number.
 */
export const PathSegmentsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const pathId = editedPathId(store.editorMode);
  const path = store.selectedPath;

  if (isNil(pathId) || isNil(path) || path.id !== pathId) {
    return null;
  }

  return (
    <PlannerPanel title={sitePlannerT.segments.panelTitle}>
      {path.points.slice(0, -1).map((_, index) => (
        <SegmentBlock
          // The list is positional by nature: a segment IS its place in the run.
          // biome-ignore lint/suspicious/noArrayIndexKey: segments have no identity beyond their index
          key={index}
          store={store}
          path={path}
          segmentIndex={index}
        />
      ))}
      <PanelHint>{sitePlannerT.segments.hint}</PanelHint>
    </PlannerPanel>
  );
});
