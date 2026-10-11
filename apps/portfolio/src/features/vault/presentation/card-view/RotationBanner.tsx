import { formatPlainDate } from '@frozik/utils/date/format';
import type { IVaultCard } from '@frozik/vault/model/card';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Alert } from '../../../../shared/ui/Alert';
import type { VaultView } from '../../application/VaultView';
import { vaultT } from '../translations';

/** A password whose period runs out within a week, or ran out: words and colour, like an expiry. */
export const RotationBanner = observer(
  ({ card, view }: { readonly card: IVaultCard; readonly view: VaultView }) => {
    const rotation = view.rotationOf(card);
    if (isNil(rotation) || (rotation.status !== 'soon' && rotation.status !== 'expired')) {
      return null;
    }
    const t = vaultT.cardExtras;
    const date = formatPlainDate(rotation.due, getCurrentLanguage());
    return rotation.status === 'expired' ? (
      <Alert type="error" message={t.rotationOverdue(date)} />
    ) : (
      <Alert type="warning" message={t.rotationSoon(date)} />
    );
  }
);
