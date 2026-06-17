import { ensureTensorflowBackend, TensorflowPlayer } from '../players/TensorflowPlayer';
import type { IRobotPlayer } from '../types';

export async function createTensorflowPlayers(populationSize: number): Promise<IRobotPlayer[]> {
  await ensureTensorflowBackend();
  return new Array(populationSize).fill(0).map(() => new TensorflowPlayer());
}
