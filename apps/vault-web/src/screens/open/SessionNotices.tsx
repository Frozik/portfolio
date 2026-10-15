import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { KeyRotatedBanner } from '@frozik/vault-react/session/KeyRotatedBanner';
import { KeysChangedNotice } from '@frozik/vault-react/session/KeysChangedNotice';
import { editorT } from '@frozik/vault-react/texts/editor';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';

/** What the session needs said above every page: a new key, changed slots, an edit a lock left waiting. */
export const SessionNotices = observer(
  ({ session, section }: { readonly session: VaultSession; readonly section: TVaultSection }) => {
    const navigate = useNavigate();
    const { offeredDraft } = session.editing;
    const continueOffered = useEventCallback(() => {
      session.editing.continueOffered();
      if (!isNil(offeredDraft)) {
        void navigate(paths.card(session.vaultKey, section, offeredDraft.card.id));
      }
    });
    return (
      <div className="flex flex-col gap-2 px-4 empty:hidden">
        <KeyRotatedBanner session={session} />
        <KeysChangedNotice keys={session.keys} settingsPath={paths.settings(session.vaultKey)} />
        {!isNil(offeredDraft) && (
          <div className="flex flex-wrap items-center gap-2 pt-2" data-testid="offered-draft">
            <Alert
              type="info"
              message={editorT.offered(offeredDraft.card.title || vaultT.list.untitled)}
            />
            <Button type="button" size="sm" onClick={continueOffered}>
              {editorT.continue}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={session.editing.discardOffered}
            >
              {editorT.discard}
            </Button>
          </div>
        )}
      </div>
    );
  }
);
