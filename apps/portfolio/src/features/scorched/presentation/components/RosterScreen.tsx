import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { memo, useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import type { ScorchedSetupOptions } from '../../application/scorched-setup';
import { useScorchedStore } from '../../application/useScorchedStore';
import { MAX_PLAYER_COUNT, MIN_PLAYER_COUNT } from '../../domain/constants';
import type { AiPersonality, PlayerController, PlayerId, PlayerSetup } from '../../domain/types';
import { GLASS_PANEL_CLASS, OVERLAY_SURFACE_CLASS } from '../constants';
import { scorchedT } from '../translations';
import { AdvancedOptionsPanel } from './AdvancedOptionsPanel';
import { CuratedOptionsRow } from './CuratedOptionsRow';
import { PlayerSwatch } from './PlayerSwatch';

const AI_PERSONALITIES: readonly AiPersonality[] = [
  'moron',
  'shooter',
  'poolshark',
  'tosser',
  'chooser',
  'spoiler',
  'cyborg',
  'unknown',
];

const HUMAN_CONTROLLER_VALUE = 'human';

function toControllerValue(controller: PlayerController): string {
  return controller.kind === 'human' ? HUMAN_CONTROLLER_VALUE : controller.personality;
}

function fromControllerValue(value: string): PlayerController {
  const personality = AI_PERSONALITIES.find(candidate => candidate === value);

  return personality === undefined ? { kind: 'human' } : { kind: 'ai', personality };
}

const selectClass =
  'w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-text ' +
  'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-brand-500';

/** One roster card: the name, the colour that identifies the tank, and who is behind the trigger. */
const PlayerCard = memo(
  ({
    player,
    onNameChange,
    onControllerChange,
  }: {
    readonly player: PlayerSetup;
    readonly onNameChange: (playerId: PlayerId, name: string) => void;
    readonly onControllerChange: (playerId: PlayerId, controller: PlayerController) => void;
  }) => {
    const controllerValue = toControllerValue(player.controller);

    const handleNameChange = useFunction((event: ChangeEvent<HTMLInputElement>) => {
      onNameChange(player.id, event.target.value);
    });

    const handleControllerChange = useFunction((event: ChangeEvent<HTMLSelectElement>) => {
      onControllerChange(player.id, fromControllerValue(event.target.value));
    });

    return (
      <li className={cn(GLASS_PANEL_CLASS, 'flex flex-col gap-2 text-left')}>
        <div className="flex items-center gap-2">
          <PlayerSwatch playerId={player.id} className="size-3.5 shrink-0" />
          <input
            value={player.name}
            onChange={handleNameChange}
            aria-label={scorchedT.roster.name}
            placeholder={scorchedT.roster.defaultName(player.id + 1)}
            className={cn(selectClass, 'font-medium')}
          />
        </div>

        <select
          value={controllerValue}
          onChange={handleControllerChange}
          aria-label={scorchedT.roster.controller}
          className={selectClass}
        >
          <option value={HUMAN_CONTROLLER_VALUE}>{scorchedT.roster.human}</option>
          {AI_PERSONALITIES.map(personality => (
            <option key={personality} value={personality}>
              {scorchedT.aiNames[personality]}
            </option>
          ))}
        </select>

        <p className="min-h-8 text-xs leading-relaxed text-text-muted">
          {player.controller.kind === 'human'
            ? scorchedT.roster.human
            : scorchedT.ai[player.controller.personality]}
        </p>
      </li>
    );
  }
);

/**
 * The single pre-match screen: a roster builder, the handful of options that actually change
 * the fun, one collapsed Advanced panel for the purists, and a prominent Start. No nested menus —
 * a player must get from here to their first shot without reading anything.
 */
export const RosterScreen = observer(() => {
  const store = useScorchedStore();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const handlePlayerCountChange = useFunction((event: ChangeEvent<HTMLSelectElement>) => {
    store.roster.setSize(Number(event.target.value));
  });

  const handleNameChange = useFunction((playerId: PlayerId, name: string) => {
    store.roster.setName(playerId, name);
  });

  const handleControllerChange = useFunction((playerId: PlayerId, controller: PlayerController) => {
    store.roster.setController(playerId, controller);
  });

  const handleSetupChange = useFunction((setup: ScorchedSetupOptions) => {
    store.roster.setOptions(setup);
  });

  const handleToggleAdvanced = useFunction(() => {
    setIsAdvancedOpen(current => !current);
  });

  const handleStart = useFunction(() => {
    store.startMatch();
  });

  return (
    <div className={OVERLAY_SURFACE_CLASS}>
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
        <header className="text-center">
          <h2 className="text-3xl font-semibold tracking-wide text-text">
            {scorchedT.roster.title}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{scorchedT.roster.subtitle}</p>
        </header>

        <label className="flex items-center justify-center gap-2 text-sm text-text-secondary">
          {scorchedT.roster.playerCount}
          <select
            value={store.roster.players.length}
            onChange={handlePlayerCountChange}
            className={cn(selectClass, 'w-20')}
          >
            {Array.from(
              { length: MAX_PLAYER_COUNT - MIN_PLAYER_COUNT + 1 },
              (_unused, index) => MIN_PLAYER_COUNT + index
            ).map(count => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {store.roster.players.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              onNameChange={handleNameChange}
              onControllerChange={handleControllerChange}
            />
          ))}
        </ul>

        <CuratedOptionsRow setup={store.roster.setup} onChange={handleSetupChange} />

        <div className={cn(GLASS_PANEL_CLASS, 'p-0')}>
          <button
            type="button"
            onClick={handleToggleAdvanced}
            aria-expanded={isAdvancedOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-text-secondary transition-colors duration-150 hover:text-text"
          >
            {scorchedT.roster.advanced}
            <span aria-hidden="true">{isAdvancedOpen ? '−' : '+'}</span>
          </button>

          {isAdvancedOpen ? (
            <AdvancedOptionsPanel setup={store.roster.setup} onChange={handleSetupChange} />
          ) : null}
        </div>

        <Button size="lg" onClick={handleStart} className="self-center px-12">
          {scorchedT.start}
        </Button>

        <p className="text-center text-xs leading-relaxed text-text-muted">
          {scorchedT.controlsHint}
        </p>
      </div>
    </div>
  );
});
