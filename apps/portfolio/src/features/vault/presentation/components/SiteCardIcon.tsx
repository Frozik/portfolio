import type { ICardState } from '@frozik/vault/model/card';
import { CardIcon } from '@frozik/vault/react/card-icon/CardIcon';
import { isNil } from 'lodash-es';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { useObjectUrl } from '../files/useObjectUrl';

/** A card's icon with its site's icon, shown through a `blob:` URL while it is on screen. */
export function SiteCardIcon({
  card,
  siteIcon,
}: {
  readonly card: ICardState;
  readonly siteIcon: Uint8Array<ArrayBuffer> | null;
}) {
  const picture = useObjectUrl(isNil(siteIcon) ? undefined : siteIcon, 'image/png');
  return <CardIcon card={card} locale={getCurrentLanguage()} picture={picture} />;
}
