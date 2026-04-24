import { isNil } from 'lodash-es';
import type { MonoTypeOperatorFunction } from 'rxjs';
import { Observable } from 'rxjs';

import { assert } from '../assert/assert';

type TChannelKey = string;

const mapKeyToChannel = new Map<TChannelKey, BroadcastChannel>();
const mapKeyToConsumersCount = new Map<TChannelKey, number>();

export function borrowChannel(key: string): BroadcastChannel {
  if (!mapKeyToChannel.has(key)) {
    mapKeyToChannel.set(key, new BroadcastChannel(key));
    mapKeyToConsumersCount.set(key, 0);
  }

  const currentCount = mapKeyToConsumersCount.get(key);
  assert(!isNil(currentCount), 'Consumer count must exist after initialization');
  mapKeyToConsumersCount.set(key, currentCount + 1);

  const channel = mapKeyToChannel.get(key);
  assert(!isNil(channel), 'Channel must exist after initialization');
  return channel;
}

export function releaseChannel(key: string): void {
  const channel = mapKeyToChannel.get(key);
  const count = mapKeyToConsumersCount.get(key);
  assert(!isNil(channel), 'Channel must exist for release');
  assert(!isNil(count), 'Consumer count must exist for release');

  // last consumer
  if (count === 1) {
    channel.close();
    mapKeyToChannel.delete(key);
    mapKeyToConsumersCount.delete(key);
  }

  mapKeyToConsumersCount.set(key, count - 1);
}

export function sendToTabs<T>(key: string): MonoTypeOperatorFunction<T> {
  return source =>
    new Observable<T>(subscriber => {
      const channel = borrowChannel(key);
      const subscription = source.subscribe({
        next(value) {
          subscriber.next(value);
          channel.postMessage(value);
        },
        error(err) {
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });
      return () => {
        subscription.unsubscribe();
        releaseChannel(key);
      };
    });
}

export function receiveFromTabs<T>(key: string): Observable<T> {
  return new Observable<T>(subscriber => {
    const channel = borrowChannel(key);
    channel.onmessage = (event: MessageEvent<T>) => {
      subscriber.next(event.data);
    };
    return () => {
      channel.onmessage = null;
      releaseChannel(key);
    };
  });
}
