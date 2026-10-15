import { formatPlainDate } from '@frozik/utils/date/format';
import type { IVaultCard } from '@frozik/vault/model/card';
import { expiresOn } from '@frozik/vault/model/expiry';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import type { VaultView } from '@frozik/vault-app/document/application/VaultView';

import { Notice } from '../kit/Notice';
import { useLanguage, useVaultTexts } from '../texts';

/** A card about to or already expired, and a password due for a change: words and colour, never colour alone. */
export const CardBanners = observer(function CardBanners({
  card,
  view,
}: {
  readonly card: IVaultCard;
  readonly view: VaultView;
}) {
  const t = useVaultTexts().cardExtras;
  const language = useLanguage();
  const status = view.expiryOf(card);
  const date = expiresOn(card);
  const rotation = view.rotationOf(card);
  return (
    <>
      {!isNil(date) && status === 'expired' && (
        <Notice
          testID="card-expired"
          tone="error"
          message={t.expired(formatPlainDate(date, language))}
        />
      )}
      {!isNil(date) && status === 'soon' && (
        <Notice
          testID="card-expires-soon"
          tone="caution"
          message={t.expiresSoon(formatPlainDate(date, language))}
        />
      )}
      {!isNil(rotation) && (rotation.status === 'soon' || rotation.status === 'expired') && (
        <Notice
          testID="card-rotation"
          tone={rotation.status === 'expired' ? 'error' : 'caution'}
          message={(rotation.status === 'expired' ? t.rotationOverdue : t.rotationSoon)(
            formatPlainDate(rotation.due, language)
          )}
        />
      )}
    </>
  );
});
