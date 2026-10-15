/** The page lets a waiting worker take over: it holds no key that a reload would lose. */
export const ACTIVATE_WAITING_WORKER = 'activate-waiting-worker';

export interface IActivateWaitingWorker {
  readonly type: typeof ACTIVATE_WAITING_WORKER;
}

export function isActivateWaitingWorker(data: unknown): data is IActivateWaitingWorker {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === ACTIVATE_WAITING_WORKER
  );
}
