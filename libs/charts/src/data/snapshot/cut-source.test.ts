import { describe, expect, it, vi } from 'vitest';

import { columnsOf } from '../../core/series/columns';
import { cutsMapping } from '../../core/viewport/axis-mapping';
import { numberDomain } from '../../core/viewport/number-domain';
import { cutSnapshotSource } from './cut-source';
import type { ISnapshotRequest, ISnapshotSource } from './source';

/** 40…60 is taken out. */
const mapping = cutsMapping(numberDomain, [{ from: 40, to: 60 }]);

function sourceOf(xs: readonly number[]) {
  const requests: ISnapshotRequest<number>[] = [];
  const listeners: ((range?: { start: number; end: number }) => void)[] = [];
  const source: ISnapshotSource<number> = {
    fetch: request => {
      requests.push(request);
      return Promise.resolve({
        data: { shape: 'point', points: xs.map(x => ({ x, value: x })) },
        range: { start: request.from, end: request.to },
      });
    },
    subscribe: listener => {
      listeners.push(listener);
      return () => {};
    },
  };
  return { source, requests, listeners };
}

describe('a snapshot source with the cuts applied at its door', () => {
  it('asks in world coordinates and answers in virtual ones without what was cut', async () => {
    const { source, requests } = sourceOf([30, 50, 70]);
    const answer = await cutSnapshotSource(source, numberDomain, mapping, 'start').fetch({
      from: 20,
      to: 60,
      shape: 'point',
      maxElements: 100,
      signal: new AbortController().signal,
    });

    expect(requests[0]).toMatchObject({ from: 20, to: 80 });
    expect([...columnsOf(answer.data).x]).toEqual([30, 50]);
    expect(answer.range).toEqual({ start: 20, end: 60 });
  });

  it('tells a change in virtual coordinates', () => {
    const { source, listeners } = sourceOf([]);
    const onChange = vi.fn();
    cutSnapshotSource(source, numberDomain, mapping, 'start').subscribe(onChange);

    listeners[0]({ start: 30, end: 70 });
    listeners[0]();

    expect(onChange).toHaveBeenNthCalledWith(1, { start: 30, end: 50 });
    expect(onChange).toHaveBeenNthCalledWith(2, undefined);
  });
});
