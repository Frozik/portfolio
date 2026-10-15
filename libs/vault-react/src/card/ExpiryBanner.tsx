import { formatPlainDate } from '@frozik/utils/date/format';
import type { IVaultCard } from '@frozik/vault/model/card';
import { expiresOn } from '@frozik/vault/model/expiry';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { Alert } from '@frozik/components/ui/Alert';
import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import { LANGUAGE } from '../texts/language';
import { vaultT } from '../texts/vault';

/** The expiry of a card that is about to or did expire: colour and words, never colour alone. */
export const ExpiryBanner = observer(
  ({ card, view }: { readonly card: IVaultCard; readonly view: VaultView }) => {
    const status = view.expiryOf(card);
    const date = expiresOn(card);
    if (isNil(date) || (status !== 'soon' && status !== 'expired')) {
      return null;
    }
    const t = vaultT.cardExtras;
    return status === 'expired' ? (
      <Alert
        type="error"
        message={t.expired(formatPlainDate(date, LANGUAGE))}
        data-testid="card-expired"
      />
    ) : (
      <Alert
        type="warning"
        message={t.expiresSoon(formatPlainDate(date, LANGUAGE))}
        data-testid="card-expires-soon"
      />
    );
  }
);
