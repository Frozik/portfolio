import type { TResult } from '@frozik/utils/result/result';
import type { Temporal } from 'temporal-polyfill';

import type { ICalendarEvent } from '../calendar-event';

export type TIcsFetchFailure =
  | { readonly kind: 'offline' }
  | { readonly kind: 'http'; readonly status: number }
  | { readonly kind: 'not-a-calendar' };

type TIcsFetched =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'body'; readonly body: string; readonly etag: string | null };

/** An iCal link over HTTPS, and the expansion of what it returned. */
export interface IIcsFeed {
  fetch(url: string, etag: string | null): Promise<TResult<TIcsFetched, TIcsFetchFailure>>;
  /** Every occurrence between two instants, recurrences and their exceptions expanded. */
  events(body: string, from: Temporal.Instant, to: Temporal.Instant): readonly ICalendarEvent[];
}
