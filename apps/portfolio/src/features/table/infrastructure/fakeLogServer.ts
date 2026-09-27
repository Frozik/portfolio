import type { ILogFetchParams, TLogLiveEvent } from '@frozik/table/core/rows/log-contracts';
import type { IRowQuery } from '@frozik/table/core/rows/row-query';
import type { TFilterModel } from '@frozik/table/extensions/filtering/model';
import { Temporal } from 'temporal-polyfill';

import type { IDemoEvent } from '../domain/demo-event';
import { generateEvents, nextEvent } from '../domain/demo-event';

export interface IFakeLogServerOptions {
  readonly historyRows?: number;
  readonly latencyMs?: number;
  readonly liveEveryMs?: number;
  readonly log?: (text: string) => void;
}

const DEFAULT_HISTORY_ROWS = 2_000;
const DEFAULT_LATENCY_MS = 350;
const DEFAULT_LIVE_EVERY_MS = 2_000;

/** A journal in memory: history is served by time chunk, live events keep arriving every few seconds. */
export function fakeLogServer(options: IFakeLogServerOptions = {}) {
  const start = Temporal.Now.instant();
  let events: IDemoEvent[] = [
    ...generateEvents(options.historyRows ?? DEFAULT_HISTORY_ROWS, start),
  ];
  const latency = options.latencyMs ?? DEFAULT_LATENCY_MS;

  const matches = (event: IDemoEvent, query: IRowQuery): boolean => {
    const level = query.filters.level as TFilterModel | undefined;
    return level?.kind === 'set' ? level.values.includes(event.level) : true;
  };

  const fetch = (params: ILogFetchParams): Promise<readonly IDemoEvent[]> => {
    options.log?.(
      `fetch ${params.direction} ${params.fromExclusive ? '(' : '['}${params.from.slice(11, 19)} … ${params.till.slice(11, 19)}${params.tillExclusive ? ')' : ']'} limit ${params.softLimit}`
    );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const within = events.filter(event => {
          const afterFrom = params.fromExclusive ? event.at > params.from : event.at >= params.from;
          const beforeTill = params.tillExclusive
            ? event.at < params.till
            : event.at <= params.till;
          return afterFrom && beforeTill && matches(event, params.query);
        });
        const ordered = params.direction === 'backward' ? [...within].reverse() : within;
        const chunk = ordered.slice(0, params.softLimit);
        options.log?.(`→ ${chunk.length} rows`);
        resolve(chunk);
      }, latency);
      params.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      });
    });
  };

  const subscribe = (
    params: { readonly query: IRowQuery; readonly signal: AbortSignal },
    emit: (event: TLogLiveEvent<IDemoEvent>) => void
  ): VoidFunction => {
    options.log?.('subscribe live');
    emit({ kind: 'start', at: Temporal.Now.instant().toString() });
    const interval = setInterval(() => {
      const event = nextEvent(events.at(-1), Temporal.Now.instant());
      events = [...events, event];
      if (matches(event, params.query)) {
        options.log?.(`append #${event.id} ${event.level}`);
        emit({ kind: 'append', rows: [event] });
      }
    }, options.liveEveryMs ?? DEFAULT_LIVE_EVERY_MS);
    return () => {
      clearInterval(interval);
      options.log?.('unsubscribe live');
    };
  };

  return { fetch, subscribe };
}
