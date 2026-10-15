import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { rotationFailureText } from '@frozik/vault-app/texts/keys/keys-wording';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { RADIUS, TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useKeysTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const paths = createVaultPaths('');

/** One line of news about the vault's keys and the one thing to do about it. */
function Strip({
  testID,
  tone,
  message,
  action,
}: {
  readonly testID: string;
  readonly tone: 'caution' | 'info';
  readonly message: string;
  readonly action: {
    readonly testID: string;
    readonly label: string;
    readonly onPress: () => void;
  };
}) {
  const palette = usePalette();
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[
        styles.strip,
        {
          borderColor: tone === 'caution' ? palette.caution : palette.line,
          backgroundColor: palette.bgCard,
        },
      ]}
    >
      <Text style={[styles.message, { color: palette.fg }]}>{message}</Text>
      <Button
        testID={action.testID}
        variant="secondary"
        label={action.label}
        onPress={action.onPress}
      />
    </View>
  );
}

/** The cloud file is under a key this session lacks: the password follows it, edits made meanwhile included. */
const KeyRotated = observer(function KeyRotated({ session }: { readonly session: VaultSession }) {
  const palette = usePalette();
  const keysTexts = useKeysTexts();
  const vaultTexts = useVaultTexts();
  const t = keysTexts.following;
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const { status } = session.cloud;
  if (status.kind !== 'stopped' || status.reason.kind !== 'key-rotated') {
    return null;
  }
  const { state } = session.rotation;
  const follow = (): void => {
    if (password === '') {
      return;
    }
    void session.rotation.follow(password);
    setPassword('');
  };
  return (
    <>
      <Strip
        testID="key-rotated"
        tone="caution"
        message={t.message}
        action={{ testID: 'key-rotated-follow', label: t.submit, onPress: () => setAsking(true) }}
      />
      <Dialog open={asking} title={t.message} onClose={() => setAsking(false)}>
        <Text style={[styles.text, { color: palette.fgDim }]}>{t.description}</Text>
        <TextField
          testID="key-rotated-password"
          label={t.password}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={follow}
          secret
        />
        {state.kind === 'failed' && (
          <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
            {rotationFailureText({ keys: keysTexts, vault: vaultTexts }, state.failure)}
          </Text>
        )}
        {state.kind === 'working' ? (
          <Busy label={t.working} />
        ) : (
          <Button
            testID="key-rotated-submit"
            label={t.submit}
            disabled={password === ''}
            onPress={follow}
          />
        )}
      </Dialog>
    </>
  );
});

/** Opened with the recovery key (a new password is due), or a newer set of keys came from another device. */
const KeysChanged = observer(function KeysChanged({ session }: { readonly session: VaultSession }) {
  const router = useRouter();
  const t = useKeysTexts();
  const { keys } = session;
  if (keys.recovering) {
    return (
      <Strip
        testID="opened-with-recovery-key"
        tone="caution"
        message={`${t.recovering.message} ${t.recovering.description}`}
        action={{
          testID: 'recovering-set-password',
          label: t.recovering.action,
          onPress: () => router.navigate(paths.settings(session.vaultKey)),
        }}
      />
    );
  }
  if (!keys.changedElsewhere) {
    return null;
  }
  return (
    <Strip
      testID="keys-changed-elsewhere"
      tone="info"
      message={`${t.changedElsewhere.message} ${t.changedElsewhere.description}`}
      action={{
        testID: 'keys-changed-dismiss',
        label: t.changedElsewhere.dismiss,
        onPress: keys.dismissNotice,
      }}
    />
  );
});

/** What the vault's keys need said above every page of an open vault. */
export function SessionNotices({ session }: { readonly session: VaultSession }) {
  return (
    <>
      <KeyRotated session={session} />
      <KeysChanged session={session} />
    </>
  );
}

const styles = StyleSheet.create({
  strip: { borderWidth: 1, borderRadius: RADIUS, padding: 12, gap: 8 },
  message: { fontSize: TEXT_SIZE.small },
  text: { fontSize: TEXT_SIZE.small },
});
