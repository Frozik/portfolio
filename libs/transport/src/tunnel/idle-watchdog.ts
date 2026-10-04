export interface IdleWatchdog {
  /** Bytes moved: the countdown starts over. */
  touch(): void;
  stop(): void;
}

/** Fires once when `touch` has not been called for `timeoutMs`. */
export function startIdleWatchdog(timeoutMs: number, onIdle: () => void): IdleWatchdog {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(onIdle, timeoutMs);
  };
  arm();
  return {
    touch: arm,
    stop: () => clearTimeout(timer),
  };
}
