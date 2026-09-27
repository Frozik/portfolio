import type { ISO } from '@frozik/utils/date/types';
import type { Temporal } from 'temporal-polyfill';

import { seededRandom } from './random';

export type TEventLevel = 'info' | 'warning' | 'error';

export interface IDemoEvent {
  readonly id: number;
  readonly at: ISO;
  readonly level: TEventLevel;
  readonly source: string;
  readonly message: string;
}

const LEVELS: readonly TEventLevel[] = ['info', 'info', 'info', 'warning', 'error'];
const SOURCES: readonly string[] = ['gateway', 'risk', 'matching', 'settlement'];
const MESSAGES: readonly string[] = [
  'Order accepted',
  'Order partially filled',
  'Position limit approached',
  'Connection re-established',
  'Settlement batch closed',
  'Rejected: insufficient margin',
];

/** A history of events ending at `end`, one every few seconds, deterministic per seed. */
export function generateEvents(
  count: number,
  end: Temporal.Instant,
  seed = 1
): readonly IDemoEvent[] {
  const random = seededRandom(seed);
  const pick = <TItem>(items: readonly TItem[]): TItem =>
    items[Math.floor(random() * items.length)];
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    at: end.subtract({ seconds: (count - index) * 3 }).toString() as ISO,
    level: pick(LEVELS),
    source: pick(SOURCES),
    message: pick(MESSAGES),
  }));
}

export function nextEvent(previous: IDemoEvent | undefined, at: Temporal.Instant): IDemoEvent {
  const id = (previous?.id ?? 0) + 1;
  const random = seededRandom(id);
  const pick = <TItem>(items: readonly TItem[]): TItem =>
    items[Math.floor(random() * items.length)];
  return {
    id,
    at: at.toString() as ISO,
    level: pick(LEVELS),
    source: pick(SOURCES),
    message: pick(MESSAGES),
  };
}
