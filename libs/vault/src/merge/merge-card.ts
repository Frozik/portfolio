import type { IVaultCard } from '../model/card';
import { compareHlc } from '../model/hlc';
import { cardState, trimHistory } from '../model/revision-edits';
import { compareVersions } from './merge-order';

export function isLocalCardWinner(local: IVaultCard, remote: IVaultCard): boolean {
  return compareVersions(local, remote, card => card.updatedAt, cardState) >= 0;
}

/**
 * The later version of the card wins whole; the other one is
 * kept in its history (MVP: no field-by-field merge) and the histories are united.
 */
export function mergeCard(local: IVaultCard, remote: IVaultCard): IVaultCard {
  const [winner, loser] = isLocalCardWinner(local, remote) ? [local, remote] : [remote, local];
  const loserIsAnotherVersion = compareHlc(winner.updatedAt, loser.updatedAt) !== 0;
  return {
    ...cardState(winner),
    history: trimHistory([
      ...winner.history,
      ...loser.history,
      ...(loserIsAnotherVersion ? [{ at: loser.updatedAt, snapshot: cardState(loser) }] : []),
    ]),
  };
}
