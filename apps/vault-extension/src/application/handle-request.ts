import { assertNever } from '@frozik/utils/assert/assertNever';
import { fromBase64Url } from '@frozik/vault/crypto/bytes';
import { isNil } from 'lodash-es';

import type { TRequest, TResponseOf } from '../domain/messages';
import type { ExtensionSession } from './ExtensionSession';

/** One request of the popup, answered by the session; any request counts as use. */
export async function handleRequest<Request extends TRequest>(
  session: ExtensionSession,
  request: Request
): Promise<TResponseOf<Request>> {
  await session.touch();
  return (await answer(session, request)) as TResponseOf<Request>;
}

async function answer(
  session: ExtensionSession,
  request: TRequest
): Promise<TResponseOf<TRequest>> {
  switch (request.kind) {
    case 'status':
      return session.status();
    case 'open-file': {
      const file = fromBase64Url(request.file);
      return { ok: !isNil(file) && (await session.openFile(file, request.name)) };
    }
    case 'unlock':
      return session.unlock(request.password);
    case 'lock':
      await session.lock();
      return null;
    case 'connect-webdav':
      return session.connectWebDav(request.source, request.password);
    case 'find-drive-vaults':
      return session.findDriveVaults(request.space, request.folder);
    case 'connect-drive':
      return session.connectDrive(request.source);
    case 'sync':
      return session.sync();
    case 'drive-sign-in':
      return session.signInToDrive();
    case 'open-protected':
      return session.openProtected(request.password);
    case 'page-cards':
      return session.pageCards(request.pageUrl);
    case 'search':
      return session.search(request.query);
    case 'card':
      return session.card(request.cardId);
    case 'reveal':
      return session.reveal(request.cardId, request.fieldId);
    case 'copy':
      return session.copy(request.cardId, request.fieldId);
    case 'copy-code':
      return session.copyCode(request.cardId, request.fieldId);
    case 'fill':
      return session.fill(request.cardId, request.tabId, request.pageUrl, request.allowInsecure);
    default:
      return assertNever(request);
  }
}
