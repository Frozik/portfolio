import { MS_PER_SECOND } from '@frozik/utils/date/constants';
import { useSyncExternalStore } from 'react';
import { Temporal } from 'temporal-polyfill';

function epochMs(): number {
  return Temporal.Now.instant().epochMilliseconds;
}

function subscribe(onChange: VoidFunction): VoidFunction {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const scheduleNext = (): void => {
    timeoutId = setTimeout(
      () => {
        onChange();
        scheduleNext();
      },
      MS_PER_SECOND - (epochMs() % MS_PER_SECOND)
    );
  };
  scheduleNext();
  return () => clearTimeout(timeoutId);
}

function readEpochSecond(): number {
  return Math.floor(epochMs() / MS_PER_SECOND);
}

export function useSecondTick(): number {
  return useSyncExternalStore(subscribe, readEpochSecond);
}
