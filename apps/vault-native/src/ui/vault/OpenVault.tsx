import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';

import { useAppModel } from '../app-model';
import { GAP, GUTTER, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useKeysTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { BiometricOffer } from './BiometricOffer';
import type { TBottomTab } from './BottomTabs';
import { BottomTabs } from './BottomTabs';
import { CopyFeedbackProvider } from './copy-feedback';
import { CopySnackbar } from './CopySnackbar';
import { ForeignVaultDialog } from './ForeignVaultDialog';
import { OfferedDraft } from './OfferedDraft';
import { ReminderSheet } from './ReminderSheet';
import { SessionProvider } from './session-context';
import { SessionNotices } from './SessionNotices';
import { SyncChip } from './SyncChip';

const paths = createVaultPaths('');
const LOCK_ICON_SIZE = 22;

function tabOf(pathname: string, vaultKey: string, searching: boolean): TBottomTab | null {
  const below = pathname
    .slice(paths.vault(vaultKey).length)
    .split('/')
    .filter(part => part !== '');
  if (below.length === 0 || below.length === 1) {
    const [page] = below;
    if (page === 'audit' || page === 'settings') {
      return page;
    }
    return searching ? 'search' : 'vault';
  }
  return null;
}

/** An open vault on a phone: its name, the cloud and the lock on top, the page, the tabs below. */
export const OpenVault = observer(function OpenVault({
  session,
  children,
}: {
  readonly session: VaultSession;
  readonly children: ReactNode;
}) {
  const { app } = useAppModel();
  const router = useRouter();
  const pathname = usePathname();
  const { search } = useGlobalSearchParams<{ search?: string }>();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const t = useVaultTexts();
  const keysTexts = useKeysTexts();
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [deviceUnlock] = useState(() => session.flows.deviceUnlockOf());
  const { vaultKey } = session;
  const current = tabOf(pathname, vaultKey, search === '1');
  const select = (tab: TBottomTab): void => {
    switch (tab) {
      case 'vault':
        return router.navigate(paths.vault(vaultKey));
      case 'search':
        return router.navigate({ pathname: paths.vault(vaultKey), params: { search: '1' } });
      case 'audit':
        return router.navigate(paths.audit(vaultKey));
      case 'settings':
        return router.navigate(paths.settings(vaultKey));
    }
  };
  return (
    <SessionProvider session={session}>
      <CopyFeedbackProvider value={setCopiedLabel}>
        <View testID="open-vault" style={[styles.frame, { backgroundColor: palette.bg }]}>
          <View
            style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: palette.line }]}
          >
            <Pressable
              testID="all-vaults"
              accessibilityRole="link"
              accessibilityLabel={t.phone.allVaults}
              onPress={() => router.dismissTo(paths.start())}
              style={styles.icon}
            >
              <MaterialIcons name="arrow-back" size={LOCK_ICON_SIZE} color={palette.fg} />
            </Pressable>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={[styles.name, { color: palette.fg }]}
            >
              {session.document.settings.name}
            </Text>
            <SyncChip cloud={session.cloud} />
            <Pressable
              testID="lock"
              accessibilityRole="button"
              accessibilityLabel={t.session.lock}
              accessibilityHint={keysTexts.quickScreen.lockCompletely}
              accessibilityActions={[
                { name: 'longpress', label: keysTexts.quickScreen.lockCompletely },
              ]}
              onAccessibilityAction={() => app.lock('complete')}
              onPress={() => app.lock('manual')}
              onLongPress={() => app.lock('complete')}
              style={styles.icon}
            >
              <MaterialIcons name="lock-outline" size={LOCK_ICON_SIZE} color={palette.fg} />
            </Pressable>
          </View>
          <View style={styles.offer}>
            <SessionNotices session={session} />
            {deviceUnlock !== null && <BiometricOffer setup={deviceUnlock} />}
            {current === 'vault' && <OfferedDraft />}
          </View>
          <KeyboardAvoidingView behavior="padding" style={styles.page}>
            {children}
          </KeyboardAvoidingView>
          <BottomTabs current={current} onSelect={select} />
          <CopySnackbar clipboard={session.clipboard} label={copiedLabel} now={session.now} />
          <ReminderSheet reminder={session.reminder} />
          <ForeignVaultDialog session={session} />
        </View>
      </CopyFeedbackProvider>
    </SessionProvider>
  );
});

const styles = StyleSheet.create({
  frame: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingLeft: 4,
    paddingRight: GUTTER,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  name: { flex: 1, fontSize: TEXT_SIZE.body, fontWeight: '600' },
  icon: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
  offer: { paddingHorizontal: GUTTER, paddingTop: GAP, gap: GAP },
  page: { flex: 1 },
});
