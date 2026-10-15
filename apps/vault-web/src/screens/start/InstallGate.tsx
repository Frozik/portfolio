import { Share } from 'lucide-react';

import { Button } from '@frozik/components/ui/Button';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { ScreenFrame } from '../frame/ScreenFrame';

const ICON_SIZE = 28;

/** An iPhone in a Safari tab: the vault belongs in the Home Screen app, so that comes first. */
export function InstallGate({ onContinue }: { readonly onContinue: () => void }) {
  const t = vaultT.install;
  return (
    <ScreenFrame className="justify-center" data-testid="install-gate">
      <Share size={ICON_SIZE} aria-hidden className="text-accent" />
      <h1 className="text-[22px] font-semibold text-fg">{t.title}</h1>
      <p className="text-[15px] text-fg-dim">{t.body}</p>
      <Button type="button" variant="ghost" className="self-start" onClick={onContinue}>
        {t.continueAnyway}
      </Button>
    </ScreenFrame>
  );
}
