import type { TCloudLink as TSharedCloudLink } from '@frozik/vault-app/cloud/domain/cloud-link';
import { isNil } from 'lodash-es';

import type { TCloudLink } from './cloud';

export function sharedLinkOf(link: TCloudLink): TSharedCloudLink {
  if (link.kind === 'google-drive') {
    return { kind: 'google-drive', ...link.source };
  }
  const { folderUrl, username, fileName } = link.source;
  return {
    kind: 'webdav',
    url: folderUrl,
    username,
    path: fileName,
    secret: { password: link.password, features: null },
  };
}

/** A WebDAV link without a password sealed here is no link: setup asks for it again. */
export function extensionLinkOf(link: TSharedCloudLink): TCloudLink | null {
  if (link.kind === 'google-drive') {
    const { space, path, account } = link;
    return { kind: 'google-drive', source: { space, path, account } };
  }
  if (isNil(link.secret)) {
    return null;
  }
  return {
    kind: 'webdav',
    source: { folderUrl: link.url, username: link.username, fileName: link.path },
    password: link.secret.password,
  };
}
