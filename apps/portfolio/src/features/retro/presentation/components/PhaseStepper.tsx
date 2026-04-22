import { useFunction } from '@frozik/components';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { cn } from '../../../../shared/lib/cn';
import { Button } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { ERetroPhase } from '../../domain/types';
import { retroT as t } from '../translations';

interface PhaseStepperProps {
  readonly store: RoomStore;
}

const PHASE_ORDER: readonly ERetroPhase[] = [
  ERetroPhase.Brainstorm,
  ERetroPhase.Group,
  ERetroPhase.Vote,
  ERetroPhase.Discuss,
  ERetroPhase.Close,
];

const PHASE_LABELS: Record<ERetroPhase, string> = {
  [ERetroPhase.Brainstorm]: t.phases.brainstorm,
  [ERetroPhase.Group]: t.phases.group,
  [ERetroPhase.Vote]: t.phases.vote,
  [ERetroPhase.Discuss]: t.phases.discuss,
  [ERetroPhase.Close]: t.phases.close,
};

export const PhaseStepper = observer(({ store }: PhaseStepperProps) => {
  const { phase, isFacilitator } = store;
  const activeIndex = PHASE_ORDER.indexOf(phase);

  const handlePrev = useFunction(() => store.rewindPhase());
  const handleNext = useFunction(() => store.advancePhase());

  return (
    <div className="flex items-center gap-2">
      {isFacilitator && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrev}
          disabled={activeIndex <= 0}
          aria-label={t.phases.prevPhase}
        >
          <ChevronLeft size={14} />
        </Button>
      )}
      <ol className="flex items-center gap-1 text-xs">
        {PHASE_ORDER.map((candidate, index) => {
          const isActive = candidate === phase;
          const isPast = index < activeIndex;
          return (
            <li
              key={candidate}
              className={cn(
                'rounded-full border px-2.5 py-1 font-medium',
                isActive && 'border-brand-400 bg-brand-500/20 text-brand-200',
                !isActive && isPast && 'border-border text-text-secondary',
                !isActive && !isPast && 'border-border/50 text-text-muted'
              )}
            >
              {PHASE_LABELS[candidate]}
            </li>
          );
        })}
      </ol>
      {isFacilitator && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNext}
          disabled={activeIndex >= PHASE_ORDER.length - 1}
          aria-label={t.phases.nextPhase}
        >
          <ChevronRight size={14} />
        </Button>
      )}
    </div>
  );
});
