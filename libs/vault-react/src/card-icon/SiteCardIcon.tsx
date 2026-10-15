import type { ICardState } from '@frozik/vault/model/card';
import { isNil } from 'lodash-es';

import { useObjectUrl } from '../hooks/useObjectUrl';
import { CardIcon } from './CardIcon';

const PNG = 'image/png';

/** A card's icon with its site's icon, shown through a `blob:` URL while it is on screen. */
export function SiteCardIcon({
  card,
  siteIcon,
  locale,
}: {
  readonly card: ICardState;
  readonly siteIcon: Uint8Array<ArrayBuffer> | null;
  readonly locale: string;
}) {
  const picture = useObjectUrl(isNil(siteIcon) ? undefined : siteIcon, PNG);
  return <CardIcon card={card} locale={locale} picture={picture} />;
}
