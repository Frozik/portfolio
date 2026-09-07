import { useSyncExternalStore } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { IAvailability } from '../../domain/availability';
import { resolveAvailability } from '../../domain/availability';
import { AWAKE_WINDOW, MY_TIMEZONE, STATUS_CHECK_INTERVAL_MS } from '../availability-constants';

export type { IAvailability, TAvailabilityStatus } from '../../domain/availability';

let lastAvailability: IAvailability | undefined;

/** Same object while nothing changed: `useSyncExternalStore` compares snapshots by identity. */
function readAvailability(): IAvailability {
  const next = resolveAvailability(Temporal.Now.zonedDateTimeISO(MY_TIMEZONE), AWAKE_WINDOW);
  if (
    lastAvailability === undefined ||
    lastAvailability.status !== next.status ||
    lastAvailability.isAwake !== next.isAwake
  ) {
    lastAvailability = next;
  }
  return lastAvailability;
}

/** What the prerendered page and the hydrating render agree on: not known yet. */
function readServerAvailability(): undefined {
  return undefined;
}

function subscribe(onChange: VoidFunction): VoidFunction {
  const intervalId = setInterval(onChange, STATUS_CHECK_INTERVAL_MS);
  return () => clearInterval(intervalId);
}

/**
 * Whether the author is likely around, `undefined` until hydration — the
 * build-time markup cannot know when the visitor opens the page.
 */
export function useAvailability(): IAvailability | undefined {
  return useSyncExternalStore(subscribe, readAvailability, readServerAvailability);
}
