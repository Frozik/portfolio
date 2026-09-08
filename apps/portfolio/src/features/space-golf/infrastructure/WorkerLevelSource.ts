import { isNil } from 'lodash-es';

import type { LevelSource } from '../application/ports/level-source';
import type { Level } from '../domain/level';
import type { LevelRequest, LevelResponse } from './level-worker-protocol';

interface PendingLevel {
  readonly resolve: (level: Level) => void;
  readonly reject: (reason: unknown) => void;
}

/** The browser's level source: one worker, requests answered by seed. */
export class WorkerLevelSource implements LevelSource {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingLevel>();

  constructor() {
    this.worker = new Worker(new URL('./level-worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleError);
  }

  generate(seed: number): Promise<Level> {
    return new Promise<Level>((resolve, reject) => {
      this.pending.set(seed, { resolve, reject });
      const request: LevelRequest = { seed };
      this.worker.postMessage(request);
    });
  }

  dispose(): void {
    this.worker.removeEventListener('message', this.handleMessage);
    this.worker.removeEventListener('error', this.handleError);
    this.worker.terminate();
    for (const request of this.pending.values()) {
      request.reject(new Error('Level source disposed'));
    }
    this.pending.clear();
  }

  private readonly handleMessage = (event: MessageEvent<LevelResponse>): void => {
    const response = event.data;
    const request = this.pending.get(response.seed);
    if (isNil(request)) {
      return;
    }
    this.pending.delete(response.seed);
    if ('level' in response) {
      request.resolve(response.level);
    } else {
      request.reject(new Error(response.error));
    }
  };

  private readonly handleError = (event: ErrorEvent): void => {
    for (const request of this.pending.values()) {
      request.reject(new Error(event.message));
    }
    this.pending.clear();
  };
}
