import type { PlayerInputs } from '../types';

/** Polled exactly once per simulated tick (§12.1). */
export interface IInputSource {
  read(): PlayerInputs;
  dispose(): void;
}
