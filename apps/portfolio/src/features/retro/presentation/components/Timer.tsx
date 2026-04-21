import { useFunction } from '@frozik/components';
import type { Milliseconds } from '@frozik/utils';
import { Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { cn } from '../../../../shared/lib/cn';
import { Button } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { DEFAULT_BRAINSTORM_DURATION_MS } from '../../domain/constants';
import { retroEnTranslations as t } from '../translations/en';

interface TimerProps {
  readonly store: RoomStore;
}

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const TWO_MINUTES_MS = (2 * SECONDS_PER_MINUTE * MS_PER_SECOND) as Milliseconds;

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds - minutes * SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
  const handleAdd = useFunction(() => store.addTimerMilliseconds(TWO_MINUTES_MS));
  const handleReset = useFunction(() => store.resetTimer(DEFAULT_BRAINSTORM_DURATION_MS));

  const isRunning = timer?.startedAt !== null && timer?.startedAt !== undefined;

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
          <Button variant="ghost" size="sm" onClick={handleAdd} aria-label={t.timer.addTwoMin}>
            <Plus size={14} />
            2m
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} aria-label={t.timer.reset}>
            <RotateCcw size={14} />
          </Button>
        </div>
      )}
    </div>
  );
});
