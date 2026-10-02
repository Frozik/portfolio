import { isNil } from 'lodash-es';

import type { ISubscribeRequest, ITimeseriesSource } from './source';

/**
 * A subscription that delivers nothing once it is cancelled: a source may
 * have a message on its way at the moment of the unsubscribe, and whoever
 * unsubscribed has already moved on.
 */
export function subscribeGuarded(
  source: ITimeseriesSource,
  request: ISubscribeRequest
): VoidFunction {
  let cancelled = false;
  const whileOpen =
    <TArgument>(handler: (argument: TArgument) => void) =>
    (argument: TArgument): void => {
      if (!cancelled) {
        handler(argument);
      }
    };
  const { onPending } = request;
  const unsubscribe = source.subscribe({
    scale: request.scale,
    shape: request.shape,
    onStart: whileOpen(request.onStart),
    onBatch: whileOpen(request.onBatch),
    onPending: isNil(onPending) ? undefined : whileOpen(onPending),
    onError: whileOpen(request.onError),
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}
