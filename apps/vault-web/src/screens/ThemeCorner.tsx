import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { ThemeMenu } from '@frozik/vault-react/appearance/ThemeMenu';
import { vaultT } from '@frozik/vault-react/texts/vault';

/** The theme in the screen's top corner; an open vault carries it in its own header instead. */
export const ThemeCorner = observer(({ app }: { readonly app: VaultApp }) =>
  isNil(app.session) ? (
    <ThemeMenu
      appearance={app.appearance}
      texts={vaultT.appearance}
      className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-40"
    />
  ) : null
);
