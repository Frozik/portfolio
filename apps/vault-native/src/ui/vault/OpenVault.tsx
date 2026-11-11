import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { usePathname, useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';

import { useAppModel } from '../app-model';
import { GAP, GUTTER, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { settingsTopicPath } from '../settings/settings-topics';
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
import { VaultBarProvider } from './vault-bar';
import { VaultSwitcher } from './VaultSwitcher';

const paths = createVaultPaths('');
const LOCK_ICON_SIZE = 22;

/** The tab a page belongs to. */
function tabOf(pathname: string, vaultKey: string): TBottomTab | null {
  const below = pathname
    .slice(paths.vault(vaultKey).length)
    .split('/')
    .filter(part => part !== '');
  const [page] = below;
  if (page === 'audit' || page === 'settings') {
    return page;
  }
  return below.length <= 1 ? 'vault' : null;
}

/** An open vault on a phone: the vault, the page's own controls or the vault's name, and the lock on top; the page; the tabs below. */
export const OpenVault = observer(function OpenVault({
  session,
  children,
}: {
  readonly session: VaultSession;
  readonly children: ReactNode;
}) {
  const { app, pendingImport } = useAppModel();
  const router = useRouter();
  const pathname = usePathname();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const t = useVaultTexts();
  const keysTexts = useKeysTexts();
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [tools, setTools] = useState<ReactNode>(null);
  const [deviceUnlock] = useState(() => session.flows.deviceUnlockOf());
  const { vaultKey } = session;
  const waitingImport = pendingImport.awaits(vaultKey);
  useEffect(() => {
    if (waitingImport) {
      router.navigate(settingsTopicPath(vaultKey, 'data'));
    }
  }, [waitingImport, router, vaultKey]);
  useEffect(() => {
    const backups = session.flows.backupFolderOf();
    void backups?.backUpIfDue();
    return () => backups?.dispose();
  }, [session]);
  const current = tabOf(pathname, vaultKey);
  const select = (tab: TBottomTab): void => {
    switch (tab) {
      case 'vault':
        return current === 'vault'
          ? router.setParams({ sections: '1' })
          : router.navigate(paths.vault(vaultKey));
      case 'audit':
        return router.navigate(paths.audit(vaultKey));
      case 'settings':
        return router.navigate(paths.settings(vaultKey));
    }
  };
  return (
    <SessionProvider session={session}>
      <CopyFeedbackProvider value={setCopiedLabel}>
        <VaultBarProvider value={setTools}>
          <View testID="open-vault" style={[styles.frame, { backgroundColor: palette.bg }]}>
            <View
              style={[
                styles.header,
                { paddingTop: insets.top + 4, borderBottomColor: palette.line },
              ]}
            >
              <VaultSwitcher session={session} />
              {isNil(tools) ? (
                <>
                  <Text
                    accessibilityRole="header"
                    numberOfLines={1}
                    style={[styles.name, { color: palette.fg }]}
                  >
                    {session.document.settings.name}
                  </Text>
                  <SyncChip cloud={session.cloud} />
                </>
              ) : (
                <View style={styles.tools}>{tools}</View>
              )}
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
            <BottomTabs
              current={current}
              counts={{
                audit: session.deviceSettings.settings.showAuditCount
                  ? session.audit.problems.size
                  : 0,
              }}
              onSelect={select}
            />
            <CopySnackbar clipboard={session.clipboard} label={copiedLabel} now={session.now} />
            <ReminderSheet reminder={session.reminder} />
            <ForeignVaultDialog session={session} />
          </View>
        </VaultBarProvider>
      </CopyFeedbackProvider>
    </SessionProvider>
  );
});

const styles = StyleSheet.create({
  frame: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
    paddingRight: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  name: { flex: 1, fontSize: TEXT_SIZE.body, fontWeight: '600' },
  tools: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  icon: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
  offer: { paddingHorizontal: GUTTER, paddingTop: GAP, gap: GAP },
  page: { flex: 1 },
});
