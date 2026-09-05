import { mergePlayerInputs } from '../domain/merge-player-inputs';
import type { IInputSource } from '../domain/ports/input-source';
import type { PlayerInputs, WorldEvent } from '../domain/types';
import type { TanksAudioController } from './TanksAudioController';
import type { TanksStore } from './TanksStore';

/** What the fixed-step driver asks of a running game, once per tick. */
export interface ITanksSimulationHost {
  isSimulating(): boolean;
  /** A pause freezes effects too; the stage-clear interlude lets the last explosion play out. */
  areEffectsRunning(): boolean;
  readInputs(): PlayerInputs;
  /** The world reuses its event array between ticks — read synchronously, never store the array. */
  onTick(inputs: PlayerInputs, events: readonly WorldEvent[]): void;
}

/** Wires one run of the game: the store's flow, the audio that follows it and the merged inputs. */
export function createTanksSession({
  store,
  audio,
  keyboard,
}: {
  readonly store: TanksStore;
  readonly audio: Pick<TanksAudioController, 'onTick'>;
  readonly keyboard: IInputSource;
}): ITanksSimulationHost {
  return {
    isSimulating: () => store.isPlaying,
    areEffectsRunning: () => store.gameStatus === 'stage-clear',
    readInputs: () => mergePlayerInputs(keyboard.read(), store.touchInput.read()),
    onTick: (inputs, events) => {
      store.applyWorldEvents(events);
      audio.onTick(inputs, events);
    },
  };
}
