import { usePendulumStore } from '../../application/usePendulumStore';
import type { ICompetition } from '../../domain/types';

export function useCompetition(): ICompetition | undefined {
  return usePendulumStore().competition;
}
