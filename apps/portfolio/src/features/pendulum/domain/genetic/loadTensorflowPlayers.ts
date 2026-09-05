import { TensorflowPlayer } from '../players/TensorflowPlayer';
import type { IRobotPlayer, RobotModelUrl } from '../types';

export function loadTensorflowPlayers(
  players: readonly { readonly name: string; readonly modelUrl: RobotModelUrl }[]
): Promise<readonly IRobotPlayer[]> {
  return Promise.all(players.map(({ name, modelUrl }) => TensorflowPlayer.load(name, modelUrl)));
}
