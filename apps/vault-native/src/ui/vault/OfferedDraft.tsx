import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { IconButton } from '../kit/IconButton';
import { Notice } from '../kit/Notice';
import { useEditorTexts, useVaultTexts } from '../texts';
import { useSession } from './session-context';

const paths = createVaultPaths('');

/** An edit a lock left sealed on this device: taken up again, or thrown away. */
export const OfferedDraft = observer(function OfferedDraft() {
  const session = useSession();
  const router = useRouter();
  const t = useEditorTexts();
  const vaultTexts = useVaultTexts();
  const { offeredDraft } = session.editing;
  if (isNil(offeredDraft)) {
    return null;
  }
  const continueOffered = (): void => {
    session.editing.continueOffered();
    router.push(paths.card(session.vaultKey, 'all', offeredDraft.card.id));
  };
  return (
    <Notice
      testID="offered-draft"
      message={t.offered(offeredDraft.card.title || vaultTexts.list.untitled)}
      actions={
        <>
          <IconButton
            testID="continue-draft"
            icon="edit"
            label={t.continue}
            onPress={continueOffered}
          />
          <IconButton
            testID="discard-draft"
            icon="delete-outline"
            label={t.discard}
            onPress={session.editing.discardOffered}
          />
        </>
      }
    />
  );
});
