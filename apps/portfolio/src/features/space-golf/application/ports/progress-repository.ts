import type { Progress } from '../../domain/progress';

export interface ProgressRepository {
  load(): Promise<Progress | undefined>;
  save(progress: Progress): Promise<void>;
}
