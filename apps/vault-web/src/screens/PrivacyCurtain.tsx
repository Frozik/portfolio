import { useSyncExternalStore } from 'react';

import { vaultT } from '@frozik/vault-react/texts/vault';

function subscribe(changed: () => void): () => void {
  document.addEventListener('visibilitychange', changed);
  return () => document.removeEventListener('visibilitychange', changed);
}

const isHidden = (): boolean => document.visibilityState === 'hidden';

/**
 * The app switcher keeps a picture of the last frame: while the app is out of
 * sight a brand screen in the current theme covers whatever was open.
 */
export function PrivacyCurtain() {
  const hidden = useSyncExternalStore(subscribe, isHidden);
  if (!hidden) {
    return null;
  }
  return (
    <div
      data-testid="privacy-curtain"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg"
    >
      <img src="/favicon.svg" alt="" className="size-16" />
      <p className="text-[15px] text-fg-dim">{vaultT.phone.curtain}</p>
    </div>
  );
}
