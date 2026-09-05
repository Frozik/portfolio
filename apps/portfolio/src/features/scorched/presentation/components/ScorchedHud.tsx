import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { ArrowLeft, ArrowRight, Volume2, VolumeX, Wind } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import { useScorchedStore } from '../../application/useScorchedStore';
import { MAX_TANK_HEALTH } from '../../domain/constants';
import { HUD_ICON_SIZE_PX } from '../constants';
import { formatAimValue, formatCash, toHealthPercent } from '../hud-format';
import { getPlayerDisplayName } from '../player-name';
import { scorchedT } from '../translations';
import { getWeaponName } from '../weapon-names';
import { PlayerSwatch } from './PlayerSwatch';

const CALM_WIND = 0;

const readoutLabelClass = 'text-[0.625rem] uppercase tracking-widest text-text-muted';

/**
 * The minimal in-game strip: whose turn it is and in what colour, their health and cash, the
 * aim they are dialling in, the wind they have to fight and the weapon on the rail. Everything
 * else the original crammed into its status bar appears contextually instead.
 */
export const ScorchedHud = observer(() => {
  const store = useScorchedStore();
  const { activePlayer, windUnits } = store.world;
  const { thinkingPlayerId: aiThinkingPlayerId } = store.ai;
  const { elevationDegrees: aimElevationDegrees, power: aimPower } = store.aim;

  const handleToggleMute = useFunction(() => {
    store.toggleMute();
  });

  const handleOpenWeapons = useFunction(() => {
    store.aim.setCarouselOpen(true);
  });

  return (
    <header
      className={
        'flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-border ' +
        'bg-surface-elevated px-3 py-2 text-text'
      }
    >
      <span className={readoutLabelClass}>
        {scorchedT.hud.round(store.world.roundNumber, store.world.roundCount)}
      </span>

      <section aria-label={scorchedT.hud.turn} className="flex items-center gap-2">
        <PlayerSwatch playerId={activePlayer?.id} className="size-3" />
        <span className="text-sm font-medium">
          {isNil(activePlayer) ? scorchedT.round.over : getPlayerDisplayName(activePlayer)}
        </span>
        {!isNil(aiThinkingPlayerId) && aiThinkingPlayerId === activePlayer?.id ? (
          <span className="text-xs text-text-muted">{scorchedT.hud.thinking}</span>
        ) : null}
      </section>

      <section aria-label={scorchedT.hud.health} className="flex min-w-32 items-center gap-2">
        <span className={readoutLabelClass}>{scorchedT.hud.health}</span>
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface">
          <span
            className="block h-full rounded-full bg-brand-400 transition-[width] duration-200"
            style={{ width: `${toHealthPercent(activePlayer?.health ?? 0, MAX_TANK_HEALTH)}%` }}
          />
        </span>
        <span className="font-mono text-xs tabular-nums text-text-secondary">
          {Math.round(activePlayer?.health ?? 0)}
        </span>
      </section>

      <section aria-label={scorchedT.hud.angle} className="flex items-baseline gap-1.5">
        <span className={readoutLabelClass}>{scorchedT.hud.angle}</span>
        <span className="font-mono text-sm tabular-nums">
          {formatAimValue(aimElevationDegrees)}°
        </span>
      </section>

      <section aria-label={scorchedT.hud.power} className="flex items-baseline gap-1.5">
        <span className={readoutLabelClass}>{scorchedT.hud.power}</span>
        <span className="font-mono text-sm tabular-nums">{formatAimValue(aimPower)}</span>
      </section>

      <section aria-label={scorchedT.hud.wind} className="flex items-center gap-1.5">
        <Wind size={HUD_ICON_SIZE_PX} className="text-text-secondary" aria-hidden="true" />
        {windUnits === CALM_WIND ? (
          <span className="font-mono text-xs text-text-muted">{scorchedT.hud.windCalm}</span>
        ) : (
          <span className="flex items-center gap-1 font-mono text-sm tabular-nums">
            {windUnits < CALM_WIND ? (
              <ArrowLeft size={HUD_ICON_SIZE_PX} aria-hidden="true" />
            ) : (
              <ArrowRight size={HUD_ICON_SIZE_PX} aria-hidden="true" />
            )}
            {Math.abs(windUnits)}
          </span>
        )}
      </section>

      <section aria-label={scorchedT.hud.cash} className="flex items-baseline gap-1.5">
        <span className={readoutLabelClass}>{scorchedT.hud.cash}</span>
        <span className="font-mono text-sm tabular-nums">
          {formatCash(activePlayer?.cash ?? 0)}
        </span>
      </section>

      <Button
        variant="secondary"
        size="sm"
        onClick={handleOpenWeapons}
        disabled={!store.isAiming || store.isAiTurn}
        aria-label={scorchedT.touch.weapons}
        className="ml-auto rounded-full"
      >
        {getWeaponName(store.aim.selectedWeaponId)}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleMute}
        aria-label={store.isMuted ? scorchedT.hud.unmute : scorchedT.hud.mute}
      >
        {store.isMuted ? (
          <VolumeX size={HUD_ICON_SIZE_PX} aria-hidden="true" />
        ) : (
          <Volume2 size={HUD_ICON_SIZE_PX} aria-hidden="true" />
        )}
      </Button>
    </header>
  );
});
