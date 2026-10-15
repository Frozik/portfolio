import { Spinner } from '@frozik/components/ui/Spinner';

import { vaultT } from '@frozik/vault-react/texts/vault';
import { ScreenFrame } from './frame/ScreenFrame';

/** This build is below the security floor: no vault opens until the new one arrives. */
export function RequiredUpdateScreen() {
  return (
    <ScreenFrame className="items-center justify-center text-center">
      <div
        role="alert"
        data-testid="update-notice"
        data-state="required"
        className="flex flex-col items-center gap-4"
      >
        <Spinner />
        <p className="text-[16px] text-fg">{vaultT.update.required}</p>
      </div>
    </ScreenFrame>
  );
}
