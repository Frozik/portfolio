import { TensorflowPlayer } from '../players/TensorflowPlayer';
import type { IRobotPlayer } from '../types';

export async function loadTensorflowPlayers(
  players: { name: string; modelUrl: string }[]
): Promise<IRobotPlayer[]> {
  return Promise.all(players.map(({ name, modelUrl }) => TensorflowPlayer.load(name, modelUrl)));
}
