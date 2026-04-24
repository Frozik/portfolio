import { useFunction } from '@frozik/components';
import type { Milliseconds } from '@frozik/utils';
import { assertNever } from '@frozik/utils';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { cn } from '../../../../shared/lib/cn';
import type { RoomStore, TimerSeverity } from '../../application/RoomStore';
import {
  DEFAULT_BRAINSTORM_DURATION_MS,
  MAX_TIMER_DURATION_MS,
  MIN_TIMER_DURATION_MS,
  TIMER_ADJUST_STEP_COARSE_MS,
  TIMER_ADJUST_STEP_FINE_MS,
} from '../../domain/constants';
import { retroT as t } from '../translations';

interface TimerProps {
  readonly store: RoomStore;
}

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const PERCENT_MULTIPLIER = 100;
const TIMER_PAD_LENGTH = 2;
const TIMER_PAD_CHAR = '0';

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds - minutes * SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(TIMER_PAD_LENGTH, TIMER_PAD_CHAR)}:${String(seconds).padStart(TIMER_PAD_LENGTH, TIMER_PAD_CHAR)}`;
}

function pickStep(event: React.MouseEvent<HTMLButtonElement>): Milliseconds {
  return event.shiftKey ? TIMER_ADJUST_STEP_FINE_MS : TIMER_ADJUST_STEP_COARSE_MS;
}

function severityClass(severity: TimerSeverity): string {
  switch (severity) {
    case 'idle':
      return 'text-landing-fg-dim';
    case 'running':
      return 'text-landing-green';
    case 'warning':
      return 'text-landing-yellow';
    case 'expired':
      return 'text-landing-red';
    default:
      return assertNever(severity);
  }
}

const ICON_BUTTON_CLASSES =
  'inline-flex h-[26px] w-[26px] items-center justify-center border border-landing-border-soft bg-transparent text-landing-fg-dim transition-colors hover:border-landing-accent/30 hover:text-landing-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-landing-border-soft disabled:hover:text-landing-fg-dim';

/**
 * Timer display + controls, ported from the `apps/retro/board.jsx` Timer.
 * Shows a mono clock with a progress underline that fills as the timer
 * runs; facilitators see −/+ adjustment buttons, play/pause, and reset.
 * Clock color shifts from green (running) → yellow (final minute) → red
 * (expired) based on `store.timerSeverity`.
 */
export const Timer = observer(({ store }: TimerProps) => {
  const { isFacilitator, timerSeverity, remainingTimerMs } = store;
  const timer = store.currentSnapshot?.meta.timer;

  const handleStart = useFunction(() => store.startTimer());
  const handlePause = useFunction(() => store.pauseTimer());
  const handleReset = useFunction(() => store.resetTimer(DEFAULT_BRAINSTORM_DURATION_MS));
  const handleDecrease = useFunction((event: React.MouseEvent<HTMLButtonElement>) => {
    store.addTimerMilliseconds(-pickStep(event) as Milliseconds);
  });
  const handleIncrease = useFunction((event: React.MouseEvent<HTMLButtonElement>) => {
    store.addTimerMilliseconds(pickStep(event));
  });

  const isRunning = timer?.startedAt !== null && timer?.startedAt !== undefined;
  const canDecrease = remainingTimerMs > MIN_TIMER_DURATION_MS;
  const canIncrease = remainingTimerMs < MAX_TIMER_DURATION_MS;

  // Progress underline grows from 0 → 100 as time elapses. The domain
  // keeps the total duration in `timer.durationMs`, so we derive the
  // percentage from the delta with `remainingTimerMs` (both are ms).
  const totalDurationMs = timer?.durationMs ?? 0;
  const progressPct =
    totalDurationMs > 0
      ? Math.min(
          PERCENT_MULTIPLIER,
          Math.max(0, ((totalDurationMs - remainingTimerMs) / totalDurationMs) * PERCENT_MULTIPLIER)
        )
      : 0;

  const clockNode = (
    <div className="relative px-1">
      <span
        className={cn(
          'block min-w-[86px] select-none text-center font-mono text-[22px] leading-none font-medium tracking-[0.04em] tabular-nums',
          severityClass(timerSeverity)
        )}
      >
        {formatClock(remainingTimerMs)}
      </span>
      <span
        aria-hidden="true"
        className="absolute right-0 -bottom-1 left-0 h-px bg-landing-border-soft"
      >
        <span
          className="block h-full bg-landing-accent transition-[width] duration-300"
          // Progress percentage is a runtime-dynamic value (1% granularity),
          // so an inline width keeps the utility set finite.
          style={{ width: `${progressPct}%` }}
        />
      </span>
    </div>
  );

  if (!isFacilitator) {
    return (
      <div className="flex items-center border border-landing-border-soft px-2.5 py-1.5">
        {clockNode}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border border-landing-border-soft px-2.5 py-1.5">
      <button
        type="button"
        onClick={handleDecrease}
        disabled={!canDecrease}
        aria-label={t.timer.decrease}
        title={t.timer.adjustHint}
        className={ICON_BUTTON_CLASSES}
      >
        <Minus size={12} />
      </button>
      {clockNode}
      <button
        type="button"
        onClick={handleIncrease}
        disabled={!canIncrease}
        aria-label={t.timer.increase}
        title={t.timer.adjustHint}
        className={ICON_BUTTON_CLASSES}
      >
        <Plus size={12} />
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-landing-border-soft" />
      {isRunning ? (
        <button
          type="button"
          onClick={handlePause}
          aria-label={t.timer.pause}
          title={t.timer.pause}
          className={cn(ICON_BUTTON_CLASSES, 'text-landing-yellow hover:text-landing-yellow')}
        >
          <Pause size={12} />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          aria-label={timer?.pausedRemainingMs !== null ? t.timer.resume : t.timer.start}
          title={timer?.pausedRemainingMs !== null ? t.timer.resume : t.timer.start}
          className={cn(ICON_BUTTON_CLASSES, 'text-landing-green hover:text-landing-green')}
        >
          <Play size={12} />
        </button>
      )}
      <button
        type="button"
        onClick={handleReset}
        aria-label={t.timer.reset}
        title={t.timer.reset}
        className={ICON_BUTTON_CLASSES}
      >
        <RotateCcw size={12} />
      </button>
    </div>
  );
});
