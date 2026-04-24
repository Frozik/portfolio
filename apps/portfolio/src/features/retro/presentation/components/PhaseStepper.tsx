import { useFunction } from '@frozik/components/hooks/useFunction';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Fragment } from 'react';

import { cn } from '../../../../shared/lib/cn';
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

const STATIC_PHASE_HINTS: Record<Exclude<ERetroPhase, ERetroPhase.Vote>, string> = {
  [ERetroPhase.Brainstorm]: t.phases.hintBrainstorm,
  [ERetroPhase.Group]: t.phases.hintGroup,
  [ERetroPhase.Discuss]: t.phases.hintDiscuss,
  [ERetroPhase.Close]: t.phases.hintClose,
};

const PHASE_NUMBER_PAD_LENGTH = 2;
const PHASE_NUMBER_PAD_CHAR = '0';

/**
 * Numbered phase stepper adapted from `apps/retro/board.jsx` PhaseProgress.
 * Shows `01 label` pills with dashed connectors; the active phase gets an
 * accent pill, passed phases show a green check, upcoming phases stay
 * faint. The facilitator also gets prev/next controls on either side so
 * the whole strip is the full phase-navigation UI.
 */
export const PhaseStepper = observer(({ store }: PhaseStepperProps) => {
  const { phase, isFacilitator } = store;
  const activeIndex = PHASE_ORDER.indexOf(phase);

  const totalVotes = store.currentSnapshot?.meta.votesPerParticipant ?? 0;
  const remainingVotes = Math.max(0, totalVotes - store.myVotesUsed);
  const currentHint =
    phase === ERetroPhase.Vote
      ? t.phases.hintVote(remainingVotes, totalVotes)
      : STATIC_PHASE_HINTS[phase];

  const handlePrev = useFunction(() => store.rewindPhase());
  const handleNext = useFunction(() => store.advancePhase());
  const handleJumpToPhase = useFunction((target: ERetroPhase) => {
    store.setPhase(target);
  });

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
      {isFacilitator && (
        <button
          type="button"
          onClick={handlePrev}
          disabled={activeIndex <= 0}
          aria-label={t.phases.prevPhase}
          title={t.phases.prevPhase}
          className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center border border-landing-border-soft text-landing-fg-dim transition-colors hover:border-landing-accent/30 hover:text-landing-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-landing-border-soft disabled:hover:text-landing-fg-dim"
        >
          <ChevronLeft size={12} />
        </button>
      )}
      <ol className="flex min-w-0 flex-1 flex-wrap items-center">
        {PHASE_ORDER.map((candidate, index) => {
          const isActive = candidate === phase;
          const isPast = index < activeIndex;
          const phaseNumber = String(index + 1).padStart(
            PHASE_NUMBER_PAD_LENGTH,
            PHASE_NUMBER_PAD_CHAR
          );
          return (
            <Fragment key={candidate}>
              <li>
                <PhaseButton
                  label={PHASE_LABELS[candidate]}
                  phaseNumber={phaseNumber}
                  isActive={isActive}
                  isPast={isPast}
                  phase={candidate}
                  canNavigate={isFacilitator}
                  onNavigate={handleJumpToPhase}
                />
              </li>
              {index < PHASE_ORDER.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mx-1 h-px w-6 shrink-0',
                    isPast ? 'bg-landing-green/50' : 'bg-landing-border-soft'
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </ol>
      <span className="ml-auto hidden max-w-[360px] truncate font-mono text-[11px] text-landing-fg-faint md:inline">
        {currentHint}
      </span>
      {isFacilitator && (
        <button
          type="button"
          onClick={handleNext}
          disabled={activeIndex >= PHASE_ORDER.length - 1}
          aria-label={t.phases.nextPhase}
          title={t.phases.nextPhase}
          className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center border border-landing-border-soft text-landing-fg-dim transition-colors hover:border-landing-accent/30 hover:text-landing-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-landing-border-soft disabled:hover:text-landing-fg-dim"
        >
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
});

interface PhaseButtonProps {
  readonly label: string;
  readonly phaseNumber: string;
  readonly isActive: boolean;
  readonly isPast: boolean;
  readonly phase: ERetroPhase;
  readonly canNavigate: boolean;
  readonly onNavigate: (phase: ERetroPhase) => void;
}

const PhaseButton = ({
  label,
  phaseNumber,
  isActive,
  isPast,
  phase,
  canNavigate,
  onNavigate,
}: PhaseButtonProps) => {
  const handleClick = useFunction(() => {
    if (!canNavigate) {
      return;
    }
    onNavigate(phase);
  });
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canNavigate}
      aria-current={isActive ? 'step' : undefined}
      className={cn(
        'flex items-center gap-2 border px-3 py-1.5 transition-colors',
        isActive
          ? 'border-landing-accent/30 bg-landing-accent/10'
          : 'border-transparent bg-transparent',
        canNavigate && !isActive && 'hover:bg-white/[0.02]',
        !canNavigate && 'cursor-default'
      )}
    >
      <span
        className={cn(
          'font-mono text-[10px] tracking-[0.08em]',
          isActive ? 'text-landing-accent' : isPast ? 'text-landing-green' : 'text-landing-fg-faint'
        )}
      >
        {phaseNumber}
      </span>
      <span
        className={cn(
          'text-xs',
          isActive
            ? 'font-medium text-landing-fg'
            : isPast
              ? 'text-landing-fg-dim'
              : 'text-landing-fg-faint'
        )}
      >
        {label}
      </span>
      {isPast && <Check size={10} className="text-landing-green" strokeWidth={1.6} />}
    </button>
  );
};
