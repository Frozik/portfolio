import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { sorting } from '../sorting/core';
import { encodeState } from './codec';
import type { IUrlPort } from './core';
import { persistence } from './core';
import { memoryStateStorage } from './memory-storage';

type TItem = { readonly id: number; readonly name: string };
const define = column<TItem>();

function fakeUrl(initial?: string): IUrlPort & { readonly parameters: Map<string, string> } {
  const parameters = new Map<string, string>(
    initial === undefined ? [] : [['tableState', initial]]
  );
  return {
    parameters,
    read: parameter => parameters.get(parameter),
    write: (parameter, value) => {
      if (value === undefined) {
        parameters.delete(parameter);
      } else {
        parameters.set(parameter, value);
      }
    },
    hrefWith: (parameter, value) => `https://example.test/?${parameter}=${value}`,
  };
}

function table(storage = memoryStateStorage(), url?: IUrlPort, version?: number) {
  return createTable({
    id: 'demo',
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
      define({ id: 'other', title: 'Other', kind: 'text', value: row => row.name }),
    ],
    rowKey: 'id',
    rows: clientRows<TItem>({ rows: () => [] }),
    extensions: [
      sorting(),
      persistence({ storage, url: url && { port: url }, version, saveDebounceMs: 0 }),
    ],
    context: undefined,
  });
}

describe('persistence', () => {
  it('saves the state after a change and restores it for the next table with the same id', async () => {
    vi.useFakeTimers();
    const storage = memoryStateStorage();
    const first = table(storage);
    first.columns.resize('name', 240);
    first.sorting.set([{ columnId: 'name', direction: 'desc' }]);
    await vi.runAllTimersAsync();
    expect(storage.states.get('demo')?.state.columns).toContainEqual({
      id: 'name',
      width: 240,
      widthBy: 'user',
      flex: undefined,
    });

    const second = table(storage);
    expect(second.columns.visible[0].width).toBe(240);
    expect(second.sorting.sort).toEqual([{ columnId: 'name', direction: 'desc' }]);
    vi.useRealTimers();
  });

  it('applies a shared link once, with priority over the storage, and clears it from the address', () => {
    const storage = memoryStateStorage();
    storage.save('demo', {
      version: 1,
      state: { columns: [{ id: 'name', width: 100 }], extensions: {} },
    });
    const shared = encodeState(
      { columns: [{ id: 'other' }, { id: 'name', width: 333 }], extensions: {} },
      1
    );
    const url = fakeUrl(shared);

    const model = table(storage, url);

    expect(model.columns.visibleIds).toEqual(['other', 'name']);
    expect(model.columns.visible[1].width).toBe(333);
    expect(url.parameters.has('tableState')).toBe(false);
    expect(model.persistence.shareLink()).toContain('tableState=');
  });

  it('ignores a state saved by another version', () => {
    const storage = memoryStateStorage();
    storage.save('demo', {
      version: 1,
      state: { columns: [{ id: 'name', width: 100 }], extensions: {} },
    });
    const model = table(storage, undefined, 2);
    expect(model.columns.visible[0].width).not.toBe(100);
  });

  it('forgets the stored state: the table and the next one with its id return to the definitions', () => {
    const storage = memoryStateStorage();
    const model = table(storage);
    model.columns.resize('name', 240);
    model.persistence.forget();
    expect(model.columns.visible[0].width).not.toBe(240);
    expect(table(storage).columns.visible[0].width).not.toBe(240);
  });
});
