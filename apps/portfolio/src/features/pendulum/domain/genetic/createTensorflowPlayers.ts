import { TensorflowPlayer } from '../players/TensorflowPlayer';
import { ensureTensorflowBackend } from '../players/tensorflow-model';
import type { IRobotPlayer } from '../types';

export async function createTensorflowPlayers(
  populationSize: number
): Promise<readonly IRobotPlayer[]> {
  await ensureTensorflowBackend();
  return Array.from({ length: populationSize }, () => new TensorflowPlayer());
}
