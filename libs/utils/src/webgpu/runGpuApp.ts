export interface GpuAppSession {
  /** Tears down everything the async initialization allocated (device included). */
  readonly cleanup: VoidFunction;
}

export interface GpuAppOptions<TSession extends GpuAppSession> {
  /** Asynchronous WebGPU bring-up — adapter/device request, layers, render loop. */
  readonly init: () => Promise<TSession>;
  /** Called with the session only when the app is still alive at init resolution. */
  readonly onReady?: (session: TSession) => void;
  /** Logged together with the rejection reason when initialization fails. */
  readonly initErrorMessage: string;
  /** Takes over from the log when the app owns its failure state (a notice instead of a blank canvas). */
  readonly onInitError?: (error: unknown) => void;
}

/**
 * Runs an asynchronously initialized WebGPU app and returns its teardown.
 *
 * Closes the mount/unmount race shared by every GPU feature: React (Strict
 * Mode especially) can unmount before `init` resolves, so the teardown may run
 * while the device request is still in flight. In that case the session is
 * disposed the moment it arrives and `onReady` never fires.
 */
export function runGpuApp<TSession extends GpuAppSession>(
  options: GpuAppOptions<TSession>
): VoidFunction {
  const { init, onReady, initErrorMessage, onInitError } = options;

  let destroyed = false;
  let gpuCleanup: VoidFunction | undefined;

  void init().then(
    session => {
      if (destroyed) {
        session.cleanup();
        return;
      }

      gpuCleanup = session.cleanup;
      onReady?.(session);
    },
    (error: unknown) => {
      if (onInitError) {
        onInitError(error);

        return;
      }

      // oxlint-disable-next-line no-console -- surfaces WebGPU app init failure
      console.error(initErrorMessage, error);
    }
  );

  return () => {
    destroyed = true;
    gpuCleanup?.();
  };
}
