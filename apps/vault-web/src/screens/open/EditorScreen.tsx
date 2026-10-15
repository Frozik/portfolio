import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import type { CardDraftModel } from '@frozik/vault-app/document/application/CardDraftModel';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { CardEditor } from '@frozik/vault-react/editor/CardEditor';
import { ProtectedDraftGate } from '@frozik/vault-react/session/ProtectedDraftGate';
import { paths } from '../paths';

/** A card being edited, full screen: the vault changes only on Save; a new card left unsaved goes. */
export const EditorScreen = observer(
  ({
    session,
    section,
    draft,
  }: {
    readonly session: VaultSession;
    readonly section: TVaultSection;
    readonly draft: CardDraftModel;
  }) => {
    const navigate = useNavigate();
    const closed = useEventCallback((saved: boolean) => {
      const wasNew = session.editing.draft?.draft.kind === 'new';
      session.editing.close();
      if (wasNew && !saved) {
        void navigate(paths.section(session.vaultKey, section));
      }
    });
    if (draft.card.protected && !session.protectedGate.isOpen) {
      return (
        <div className="px-4 pt-3">
          <ProtectedDraftGate session={session} />
        </div>
      );
    }
    return (
      <div className="overflow-y-auto px-4 pt-3 pb-8" data-testid="card-editor">
        <CardEditor
          key={draft.card.id}
          draft={draft}
          random={session.random}
          assets={session.document.assets}
          siteIcon={session.view.siteIconOf(draft.card)}
          readOnly={session.readOnly}
          onScanOtp={session.editing.scanOtp}
          onClosed={closed}
        />
      </div>
    );
  }
);
