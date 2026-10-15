import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';

import { useAppModel } from '../app-model';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { useCloudTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/**
 * The cloud file opened, but it is another vault: never merged in silence.
 * This vault over it (an explicit overwrite), or no cloud for this vault; the
 * other one opens from the start screen.
 */
export const ForeignVaultDialog = observer(function ForeignVaultDialog({
  session,
}: {
  readonly session: VaultSession;
}) {
  const { app } = useAppModel();
  const palette = usePalette();
  const cloudTexts = useCloudTexts();
  const t = cloudTexts.foreign;
  const [dismissed, setDismissed] = useState(false);
  const [failed, setFailed] = useState(false);
  const { status, connection } = session.cloud;
  const open = !dismissed && status.kind === 'stopped' && status.reason.kind === 'foreign-vault';
  const replace = (): void => {
    setFailed(false);
    void session.cloud.replaceRemote().then(result => setFailed(!result.ok));
  };
  return (
    <Dialog testID="foreign-vault" open={open} title={t.title} onClose={() => setDismissed(true)}>
      <Text style={[styles.text, { color: palette.fgDim }]}>
        {t.description(connection?.location.path ?? '')}
      </Text>
      <Text style={[styles.text, { color: palette.fgFaint }]}>{t.openOther}</Text>
      {failed && <Notice tone="error" message={t.replaceFailed} />}
      <Button testID="foreign-replace" variant="danger" label={t.replace} onPress={replace} />
      <Button
        testID="foreign-disconnect"
        variant="secondary"
        label={cloudTexts.section.disconnect}
        onPress={() => void app.cloud.disconnect(session)}
      />
    </Dialog>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
});
