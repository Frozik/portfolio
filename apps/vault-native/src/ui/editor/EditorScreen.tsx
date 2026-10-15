import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CardDraftModel } from '@frozik/vault-app/document/application/CardDraftModel';

import { ProtectedGate } from '../card/ProtectedGate';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { GAP, GUTTER, TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { useEditorTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';
import { CardEditor } from './CardEditor';

type TLeaveAction = Parameters<Parameters<typeof usePreventRemove>[1]>[0]['data']['action'];

/**
 * A card being edited, full screen: the vault changes only on Save; a new card
 * left unsaved goes. The system back leaves too — a changed draft asks first,
 * an unchanged one simply closes — while a lock keeps the draft sealed for
 * the next unlock.
 */
export const EditorScreen = observer(function EditorScreen({
  draft,
}: {
  readonly draft: CardDraftModel;
}) {
  const session = useSession();
  const router = useRouter();
  const navigation = useNavigation();
  const palette = usePalette();
  const t = useVaultTexts();
  const editorTexts = useEditorTexts();
  const [openingGate, setOpeningGate] = useState(false);
  const [leaving, setLeaving] = useState<TLeaveAction | null>(null);
  usePreventRemove(draft.dirty, ({ data }) => setLeaving(data.action));
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (!draft.dirty && session.editing.draft === draft) {
          session.editing.close();
        }
      }),
    [navigation, session, draft]
  );
  const closed = (saved: boolean): void => {
    const wasNew = session.editing.draft?.draft.kind === 'new';
    session.editing.close();
    if (wasNew && !saved) {
      router.back();
    }
  };
  if (draft.card.protected && !session.protectedGate.isOpen) {
    return (
      <View style={styles.gate}>
        <Notice message={t.card.protectedNotice} />
        <Button
          testID="open-protected"
          label={t.protectedGate.open}
          onPress={() => setOpeningGate(true)}
        />
        <Button
          testID="discard-protected-draft"
          variant="secondary"
          label={editorTexts.discard}
          onPress={() => {
            draft.discard();
            closed(false);
          }}
        />
        {openingGate && <ProtectedGate onClose={() => setOpeningGate(false)} />}
      </View>
    );
  }
  return (
    <>
      <CardEditor
        key={draft.card.id}
        draft={draft}
        random={session.random}
        assets={session.document.assets}
        readOnly={session.readOnly}
        siteIcon={session.view.siteIconOf(draft.card)}
        onClosed={closed}
      />
      {leaving !== null && (
        <Dialog open title={editorTexts.discardTitle} onClose={() => setLeaving(null)}>
          <Text style={[styles.text, { color: palette.fgDim }]}>{editorTexts.discardMessage}</Text>
          <Button
            testID="confirm-leave"
            variant="danger"
            label={editorTexts.discard}
            onPress={() => {
              session.editing.close();
              navigation.dispatch(leaving);
            }}
          />
          <Button
            variant="secondary"
            label={editorTexts.keepEditing}
            onPress={() => setLeaving(null)}
          />
        </Dialog>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  gate: { gap: GAP, padding: GUTTER },
  text: { fontSize: TEXT_SIZE.small },
});
