import type { PlayerInputs } from '../types';

/** Polled exactly once per simulated tick. */
export interface IInputSource {
  read(): PlayerInputs;
  dispose(): void;
}
