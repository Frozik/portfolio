import { TensorflowPlayer } from '../players/TensorflowPlayer';
import type { IRobotPlayer } from '../types';

export function createTensorflowPlayers(populationSize: number): IRobotPlayer[] {
  return new Array(populationSize).fill(0).map(() => new TensorflowPlayer());
}
