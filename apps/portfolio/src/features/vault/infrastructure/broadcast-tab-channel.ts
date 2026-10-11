import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { z } from 'zod';

import type { ITabChannel, TTabMessage } from '../domain/ports/tab-channel';

const TAB_MESSAGE_SCHEMA = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('changed') }),
  z.object({ kind: z.literal('locked') }),
]);

/** `BroadcastChannel('pwv:<vaultId>')`; anything that is not a known message is dropped. */
export function openBroadcastTabChannel(vaultKey: TVaultKey): ITabChannel {
  const channel = new BroadcastChannel(`pwv:${vaultKey}`);
  return {
    post: message => channel.postMessage(message),
    onMessage: listener => {
      const controller = new AbortController();
      channel.addEventListener(
        'message',
        ({ data }: MessageEvent<unknown>) => {
          const parsed = TAB_MESSAGE_SCHEMA.safeParse(data);
          if (parsed.success) {
            listener(parsed.data satisfies TTabMessage);
          }
        },
        { signal: controller.signal }
      );
      return () => controller.abort();
    },
    close: () => channel.close(),
  };
}
