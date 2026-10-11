import { assert } from '../assert/assert';
import type { IInMemoryWorkerPair } from './in-memory-worker.test-helper';
import { createInMemoryWorkerPair } from './in-memory-worker.test-helper';
import { createRpcClient } from './rpc-client';
import type { TRpcHandlers } from './rpc-server';
import { serveRpc } from './rpc-server';

type TEchoContract = {
  readonly double: { readonly request: number; readonly response: number };
  readonly fill: {
    readonly request: { readonly bytes: Uint8Array<ArrayBuffer>; readonly value: number };
    readonly response: Uint8Array<ArrayBuffer>;
  };
  readonly fail: { readonly request: string; readonly response: never };
  readonly failUncloneably: { readonly request: null; readonly response: never };
  readonly wait: { readonly request: null; readonly response: 'done' };
};

interface IEchoHandlers extends TRpcHandlers<TEchoContract> {
  readonly waitSignals: AbortSignal[];
  readonly filled: Uint8Array[];
}

function createEchoHandlers(): IEchoHandlers {
  const waitSignals: AbortSignal[] = [];
  const filled: Uint8Array[] = [];
  return {
    waitSignals,
    filled,
    double: { handle: value => value * 2 },
    fill: {
      handle: ({ bytes, value }) => {
        filled.push(bytes);
        return bytes.fill(value);
      },
      transfer: bytes => [bytes.buffer],
    },
    fail: {
      handle: message => {
        throw new Error(message);
      },
    },
    failUncloneably: {
      handle: () => {
        throw new Error('with a function inside', { cause: () => 'not cloneable' });
      },
    },
    wait: {
      handle: (_request, signal) => {
        waitSignals.push(signal);
        return new Promise(resolve => signal.addEventListener('abort', () => resolve('done')));
      },
    },
  };
}

function connect(): IInMemoryWorkerPair & {
  readonly client: ReturnType<typeof createRpcClient<TEchoContract>>;
  readonly handlers: IEchoHandlers;
} {
  const pair = createInMemoryWorkerPair();
  const handlers = createEchoHandlers();
  serveRpc<TEchoContract>(pair.scope, handlers);
  return { ...pair, handlers, client: createRpcClient<TEchoContract>(pair.worker) };
}

describe('worker RPC', () => {
  it('answers each call with the response of its own method', async () => {
    const { client } = connect();

    const [first, second] = await Promise.all([
      client.call('double', 2),
      client.call('double', 21),
    ]);

    expect(first).toEqual({ ok: true, value: 4 });
    expect(second).toEqual({ ok: true, value: 42 });
  });

  it('hands buffers over in both directions instead of copying them', async () => {
    const { client, handlers } = connect();
    const bytes = new Uint8Array(4);

    const result = await client.call('fill', { bytes, value: 7 }, { transfer: [bytes.buffer] });

    expect(bytes.byteLength).toBe(0);
    expect(handlers.filled[0]?.byteLength).toBe(0);
    expect(result).toEqual({ ok: true, value: new Uint8Array([7, 7, 7, 7]) });
  });

  it('settles a call it could not send and leaves no listener on its signal', async () => {
    const { client, handlers } = connect();
    const bytes = new Uint8Array(4);
    structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

    const result = await client.call(
      'fill',
      { bytes, value: 1 },
      { signal: controller.signal, transfer: [bytes.buffer] }
    );

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'not-sent', error: { name: 'DataCloneError' } },
    });
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(handlers.filled).toHaveLength(0);
  });

  it('returns what the handler threw as a value', async () => {
    const { client } = connect();

    const result = await client.call('fail', 'broken');

    assert(!result.ok);
    expect(result.error).toMatchObject({ kind: 'handler-threw', error: { message: 'broken' } });
  });

  it('still answers when what the handler threw cannot be cloned', async () => {
    const { client } = connect();

    const result = await client.call('failUncloneably', null);

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'handler-threw', error: { name: 'DataCloneError' } },
    });
  });

  it('settles an aborted call at once and aborts its handler in the worker', async () => {
    const { client, handlers } = connect();
    const controller = new AbortController();

    const pending = client.call('wait', null, { signal: controller.signal });
    await vi.waitFor(() => expect(handlers.waitSignals).toHaveLength(1));
    controller.abort();

    expect(await pending).toEqual({ ok: false, error: { kind: 'aborted' } });
    await vi.waitFor(() => expect(handlers.waitSignals[0]?.aborted).toBe(true));
  });

  it('does not send a call whose signal is already aborted', async () => {
    const { client, handlers } = connect();

    const result = await client.call('wait', null, { signal: AbortSignal.abort() });

    expect(result).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(handlers.waitSignals).toHaveLength(0);
  });

  it('settles every call in flight when the worker crashes, and every later call, with the cause', async () => {
    const { client, crash, isTerminated } = connect();
    const cause = new Error('module failed to load');
    const crashed = { ok: false, error: { kind: 'worker-crashed', reason: cause } };

    const pending = client.call('wait', null);
    crash(new ErrorEvent('error', { error: cause, message: cause.message }));

    expect(await pending).toEqual(crashed);
    expect(await client.call('double', 1)).toEqual(crashed);
    expect(isTerminated()).toBe(true);
  });

  it('treats a reply it cannot deserialize as a crash', async () => {
    const { client, crash } = connect();
    const event = new MessageEvent('messageerror');

    const pending = client.call('wait', null);
    crash(event);

    expect(await pending).toEqual({ ok: false, error: { kind: 'worker-crashed', reason: event } });
  });

  it('terminates the worker on dispose and settles what was in flight', async () => {
    const { client, isTerminated } = connect();

    const pending = client.call('wait', null);
    client.dispose();

    expect(await pending).toEqual({ ok: false, error: { kind: 'disposed' } });
    expect(isTerminated()).toBe(true);
  });
});
