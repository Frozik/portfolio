import { shareReplay } from 'rxjs';

export function shareReplayWithImmediateReset<T>(replay = 1) {
  return shareReplay<T>({
    bufferSize: replay,
    refCount: true,
  });
}
