import { runGpuApp } from './runGpuApp';

const INIT_ERROR_MESSAGE = 'Failed to initialize test renderer';

describe('runGpuApp', () => {
  it('keeps the session alive until teardown is called', async () => {
    const cleanup = vi.fn();
    const onReady = vi.fn();

    const stopGpuApp = runGpuApp({
      init: () => Promise.resolve({ cleanup }),
      onReady,
      initErrorMessage: INIT_ERROR_MESSAGE,
    });

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith({ cleanup }));
    expect(cleanup).not.toHaveBeenCalled();

    stopGpuApp();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('disposes the session and skips onReady when teardown wins the race', async () => {
    const cleanup = vi.fn();
    const onReady = vi.fn();
    let resolveInit: ((session: { cleanup: VoidFunction }) => void) | undefined;

    const stopGpuApp = runGpuApp({
      init: () =>
        new Promise<{ cleanup: VoidFunction }>(resolve => {
          resolveInit = resolve;
        }),
      onReady,
      initErrorMessage: INIT_ERROR_MESSAGE,
    });

    stopGpuApp();
    expect(cleanup).not.toHaveBeenCalled();

    resolveInit?.({ cleanup });

    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1));
    expect(onReady).not.toHaveBeenCalled();
  });

  it('logs initialization failures and leaves teardown harmless', async () => {
    const onReady = vi.fn();
    const initError = new Error('no adapter');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const stopGpuApp = runGpuApp({
      init: () => Promise.reject(initError),
      onReady,
      initErrorMessage: INIT_ERROR_MESSAGE,
    });

    await vi.waitFor(() =>
      expect(consoleErrorSpy).toHaveBeenCalledWith(INIT_ERROR_MESSAGE, initError)
    );

    expect(onReady).not.toHaveBeenCalled();
    expect(stopGpuApp).not.toThrow();

    consoleErrorSpy.mockRestore();
  });
});
