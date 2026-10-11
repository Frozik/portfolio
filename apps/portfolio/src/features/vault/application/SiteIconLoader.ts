import type { IHlc } from '@frozik/vault/model/hlc';
import { setSiteIcon, siteIconsWanted } from '@frozik/vault/model/site-icons';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import { isNil } from 'lodash-es';
import { reaction } from 'mobx';

import type { TFetchSiteIcon } from '../domain/ports/site-icons';
import type { TTransact } from './transact';

/**
 * The icons of the vault's sites, fetched once per domain and
 * kept in the vault, so every device shows them without asking again. One
 * domain at a time; a domain that got no answer waits for the next session.
 */
export function startSiteIconLoader({
  document,
  enabled,
  fetchIcon,
  transact,
  now,
  signal,
}: {
  readonly document: () => IVaultDocument;
  /** The device setting and a session that may write; the demo's own sites come with icons. */
  readonly enabled: () => boolean;
  readonly fetchIcon: TFetchSiteIcon;
  readonly transact: TTransact;
  readonly now: () => number;
  readonly signal: AbortSignal;
}): () => void {
  const asked = new Set<string>();
  let running = false;
  const load = async (): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    try {
      for (;;) {
        const [next] = siteIconsWanted(document(), now()).filter(domain => !asked.has(domain));
        if (isNil(next) || !enabled() || signal.aborted) {
          return;
        }
        asked.add(next);
        const fetched = await fetchIcon(next, signal);
        if (fetched.kind !== 'failed' && !signal.aborted) {
          transact((current, at: IHlc) => ({
            document: setSiteIcon(
              current,
              next,
              fetched.kind === 'icon'
                ? { kind: 'icon', png: fetched.png, at }
                : { kind: 'none', at }
            ),
            result: undefined,
          }));
        }
      }
    } finally {
      running = false;
    }
  };
  return reaction(
    () => enabled() && siteIconsWanted(document(), now()).length > 0,
    wanted => {
      if (wanted) {
        void load();
      }
    },
    { fireImmediately: true }
  );
}
