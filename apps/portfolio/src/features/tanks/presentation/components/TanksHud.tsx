import { useFunction } from '@frozik/components/hooks/useFunction';
import { range } from 'lodash-es';
import { Flag, Volume2, VolumeX } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { useTanksStore } from '../../application/useTanksStore';
import { HUD_ICON_SIZE_PX } from '../constants';
import { tanksT } from '../translations';
import { TankGlyph } from './TankGlyph';

export const TanksHud = observer(() => {
  const store = useTanksStore();
  const { stageNumber, score, bestScore, lives, enemiesRemaining, isMuted } = store;
  const enemySlots = useMemo(() => range(enemiesRemaining), [enemiesRemaining]);

  const handleMuteClick = useFunction(() => {
    store.toggleMute();
  });

  return (
    <aside
      className={
        'flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 ' +
        'border-b border-border bg-surface-elevated px-3 py-2 text-text ' +
        'landscape:order-last landscape:w-44 landscape:flex-col landscape:items-stretch ' +
        'landscape:justify-start landscape:gap-6 landscape:border-b-0 landscape:border-l ' +
        'landscape:px-4 landscape:py-6'
      }
    >
      <section aria-label={tanksT.hud.enemiesLeft} className="flex items-center gap-2">
        <div className="flex max-w-28 flex-wrap gap-x-1 gap-y-0.5 landscape:max-w-full">
          {enemySlots.map(enemySlot => (
            <TankGlyph key={enemySlot} className="size-2.5 text-text-secondary" />
          ))}
        </div>
        <span className="font-mono text-xs tabular-nums text-text-muted">{enemiesRemaining}</span>
      </section>

      <section aria-label={tanksT.hud.lives} className="flex items-center gap-1.5">
        <span className="font-mono text-xs text-text-muted">IP</span>
        <TankGlyph className="size-3.5 text-brand-400" />
        <span className="font-mono text-sm tabular-nums">{lives}</span>
      </section>

      <section aria-label={tanksT.hud.stage} className="flex items-center gap-1.5">
        <Flag size={HUD_ICON_SIZE_PX} className="text-text-secondary" aria-hidden="true" />
        <span className="font-mono text-sm tabular-nums">{stageNumber}</span>
      </section>

      <Button
        variant="ghost"
        size="sm"
        aria-pressed={isMuted}
        aria-label={isMuted ? tanksT.hud.unmute : tanksT.hud.mute}
        onClick={handleMuteClick}
        className="text-text-secondary landscape:self-start"
      >
        {isMuted ? (
          <VolumeX size={HUD_ICON_SIZE_PX} aria-hidden="true" />
        ) : (
          <Volume2 size={HUD_ICON_SIZE_PX} aria-hidden="true" />
        )}
      </Button>

      <section className="flex items-center gap-4 landscape:flex-col landscape:items-stretch landscape:gap-2">
        <div className="flex items-baseline gap-1.5 landscape:justify-between">
          <span className="text-[0.625rem] uppercase tracking-widest text-text-muted">
            {tanksT.hud.score}
          </span>
          <span className="font-mono text-sm tabular-nums">{score}</span>
        </div>
        <div className="flex items-baseline gap-1.5 landscape:justify-between">
          <span className="text-[0.625rem] uppercase tracking-widest text-text-muted">
            {tanksT.hud.bestScore}
          </span>
          <span className="font-mono text-sm tabular-nums text-text-secondary">{bestScore}</span>
        </div>
      </section>
    </aside>
  );
});
