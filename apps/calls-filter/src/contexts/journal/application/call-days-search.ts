import { findsCall } from '../domain/call-search';
import type { ICallDay } from './CallsStore';

/** The days with the calls the query finds; a day left without any is dropped. */
export function searchCallDays(days: readonly ICallDay[], query: string): readonly ICallDay[] {
  return days
    .map(day => ({ ...day, rows: day.rows.filter(row => findsCall(row.entry, query)) }))
    .filter(day => day.rows.length > 0);
}
