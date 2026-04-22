import { useFunction } from '@frozik/components';
import type { Milliseconds } from '@frozik/utils';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { cn } from '../../../../shared/lib/cn';
import { Button } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
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

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds - minutes * SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function pickStep(event: React.MouseEvent<HTMLButtonElement>): Milliseconds {
  return event.shiftKey ? TIMER_ADJUST_STEP_FINE_MS : TIMER_ADJUST_STEP_COARSE_MS;
}

const severityClass: Record<string, string> = {
  idle: 'text-text-muted',
  running: 'text-emerald-500',
  warning: 'text-amber-500',
  expired: 'text-red-500',
};

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
  // Only disable when already sitting exactly on the bound — the store
  // clamps intermediate steps (e.g. -30s at 55s lands on 30s).
  const canDecrease = remainingTimerMs > MIN_TIMER_DURATION_MS;
  const canIncrease = remainingTimerMs < MAX_TIMER_DURATION_MS;

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'font-mono text-2xl font-semibold tabular-nums',
          severityClass[timerSeverity] ?? severityClass.idle
        )}
      >
        {formatClock(remainingTimerMs)}
      </span>
      {isFacilitator && (
        <div className="flex items-center gap-1">
          {isRunning ? (
            <Button variant="ghost" size="sm" onClick={handlePause} aria-label={t.timer.pause}>
              <Pause size={14} />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStart}
              aria-label={timer?.pausedRemainingMs !== null ? t.timer.resume : t.timer.start}
            >
              <Play size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDecrease}
            disabled={!canDecrease}
            aria-label={t.timer.decrease}
            title={t.timer.adjustHint}
          >
            <Minus size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleIncrease}
            disabled={!canIncrease}
            aria-label={t.timer.increase}
            title={t.timer.adjustHint}
          >
            <Plus size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} aria-label={t.timer.reset}>
            <RotateCcw size={14} />
          </Button>
        </div>
      )}
    </div>
  );
});
