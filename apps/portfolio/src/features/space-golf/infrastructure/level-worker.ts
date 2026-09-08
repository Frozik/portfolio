import { generateLevel } from '../domain/generator/generate-level';
import type { LevelRequest, LevelResponse } from './level-worker-protocol';

/** Generates levels off the main thread: the solver's physics runs for up to a second per seed. */
addEventListener('message', (event: MessageEvent<LevelRequest>) => {
  const { seed } = event.data;
  let response: LevelResponse;
  try {
    response = { seed, level: generateLevel(seed) };
  } catch (error) {
    response = { seed, error: error instanceof Error ? error.message : String(error) };
  }
  postMessage(response);
});
