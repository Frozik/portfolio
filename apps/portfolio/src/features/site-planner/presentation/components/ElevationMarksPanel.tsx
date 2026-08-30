import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { ElevationMark } from '../../domain/model/site-plan';
import { formatMeters } from '../../domain/plan-draw/shared';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { ElevationCsvDialog } from './ElevationCsvDialog';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const ICON_SIZE_PX = 14;
const COORDINATE_SEPARATOR = ' · ';

const ACTION_BUTTON_CLASS = cn(
  'flex size-6 shrink-0 items-center justify-center rounded text-text-secondary',
  'transition-colors duration-150 hover:bg-white/10 hover:text-text',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
);

const MarkRow = observer(
  ({ store, mark }: { readonly store: SitePlannerStore; readonly mark: ElevationMark }) => {
    const { selection } = store;
    const { meterUnit } = sitePlannerT.plan;
    const isSelected =
      !isNil(selection) && selection.kind === 'mark' && selection.markId === mark.id;

    const handleSelect = useFunction(() => store.setSelection({ kind: 'mark', markId: mark.id }));
    const handleRemove = useFunction(() => store.removeElevationMark(mark.id));

    return (
      <li
        className={cn(
          'flex items-center gap-0.5 rounded-lg px-1 py-0.5',
          isSelected ? 'bg-brand-500/20' : 'hover:bg-white/5'
        )}
      >
        <button
          type="button"
          aria-pressed={isSelected}
          onClick={handleSelect}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-2 rounded px-1 py-1 text-left',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            isSelected ? 'text-text' : 'text-text-secondary'
          )}
        >
          <span className="truncate font-mono text-[11px]">
            {mark.position.x.toFixed(METER_DECIMALS)}
            {COORDINATE_SEPARATOR}
            {mark.position.y.toFixed(METER_DECIMALS)}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-text">
            {formatMeters(mark.elevation, meterUnit)}
          </span>
        </button>

        <button
          type="button"
          aria-label={sitePlannerT.marks.remove}
          onClick={handleRemove}
          className={ACTION_BUTTON_CLASS}
        >
          <Trash2 size={ICON_SIZE_PX} aria-hidden />
        </button>
      </li>
    );
  }
);

/**
 * The surveyed marks, listed as they were entered. Both ways in live here: one
 * at a time with the elevation tool on the canvas, or a whole survey pasted in.
 */
export const ElevationMarksPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);

  const handleOpenCsvDialog = useFunction(() => setIsCsvDialogOpen(true));
  const handleCloseCsvDialog = useFunction(() => setIsCsvDialogOpen(false));

  const { elevationMarks } = store;

  return (
    <PlannerPanel title={sitePlannerT.marks.title}>
      {elevationMarks.length === 0 ? (
        <PanelHint className="px-2 py-1">{sitePlannerT.marks.empty}</PanelHint>
      ) : (
        <ul className="flex flex-col">
          {elevationMarks.map(mark => (
            <MarkRow key={mark.id} store={store} mark={mark} />
          ))}
        </ul>
      )}

      <Button variant="secondary" size="sm" onClick={handleOpenCsvDialog}>
        {sitePlannerT.marks.pasteCsv}
      </Button>

      <ElevationCsvDialog
        open={isCsvDialogOpen}
        onClose={handleCloseCsvDialog}
        onSubmit={store.addElevationMarks}
      />
    </PlannerPanel>
  );
});
