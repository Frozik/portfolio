import { matchUrl } from '@frozik/vault/model/url-match';
import { isNil } from 'lodash-es';

import type { IFillRequest } from './ports';

/** What a frame says about itself: its own address, and whether the tab's top page is HTTPS. */
export interface IFrameFacts {
  readonly url: string;
  readonly topIsSecure: boolean;
}

export type TFrameVerdict = 'fill' | 'other-site' | 'insecure-page';

/**
 * Whether a frame may get the card's values: its address
 * matches one of the card's, and it is HTTPS — plain HTTP only when the user
 * allowed it, and never an HTTP frame inside an HTTPS page.
 */
export function frameVerdict(
  request: Pick<IFillRequest, 'addresses' | 'allowInsecure'>,
  frame: IFrameFacts
): TFrameVerdict {
  const secure = new URL(frame.url).protocol === 'https:';
  if (!secure && (frame.topIsSecure || !request.allowInsecure)) {
    return 'insecure-page';
  }
  return request.addresses.some(({ stored, spec }) => !isNil(matchUrl(stored, spec, frame.url)))
    ? 'fill'
    : 'other-site';
}
