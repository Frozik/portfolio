/** What the takeover reads of `navigator.serviceWorker`. */
export interface IWorkerContainer {
  readonly controller: object | null;
  addEventListener(type: 'controllerchange', listener: () => void): void;
  removeEventListener(type: 'controllerchange', listener: () => void): void;
}

/**
 * Every time a service worker takes control of this page. `firstClaim` marks
 * the one case that brings nothing new: a page that started uncontrolled (a
 * first visit) being claimed by the worker it just installed.
 */
export function onWorkerTakeover(
  container: IWorkerContainer,
  listener: (takeover: { readonly firstClaim: boolean }) => void
): () => void {
  let awaitingFirstClaim = container.controller === null;
  const changed = (): void => {
    const firstClaim = awaitingFirstClaim;
    awaitingFirstClaim = false;
    listener({ firstClaim });
  };
  container.addEventListener('controllerchange', changed);
  return () => container.removeEventListener('controllerchange', changed);
}
