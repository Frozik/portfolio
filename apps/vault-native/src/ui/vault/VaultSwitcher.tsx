import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';

import { useAppModel } from '../app-model';
import { GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { SyncChip } from './SyncChip';

const paths = createVaultPaths('');
const AVATAR_SIZE = 34;
const DOT_SIZE = 10;

/** The open vault as its first letter; pressed, the vaults this phone knows, to move to another. */
export const VaultSwitcher = observer(function VaultSwitcher({
  session,
}: {
  readonly session: VaultSession;
}) {
  const { app } = useAppModel();
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const t = useVaultTexts();
  const [open, setOpen] = useState(false);
  const name = session.document.settings.name;
  const { status } = session.cloud;
  const trouble = status.kind === 'stopped' || status.kind === 'unreachable';
  const close = (): void => setOpen(false);
  return (
    <>
      <Pressable
        testID="vault-switcher"
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={t.phone.vaults}
        onPress={() => setOpen(true)}
        style={styles.touch}
      >
        <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
          <Text style={[styles.letter, { color: palette.accent }]}>
            {name.trim().charAt(0).toUpperCase()}
          </Text>
        </View>
        {trouble && (
          <View
            testID="cloud-trouble"
            style={[styles.dot, { backgroundColor: palette.danger, borderColor: palette.bg }]}
          />
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.phone.close}
          onPress={close}
          style={[styles.scrim, { backgroundColor: palette.scrim }]}
        />
        <View
          testID="vault-sheet"
          style={[
            styles.sheet,
            { backgroundColor: palette.bgElevated, paddingBottom: insets.bottom + GUTTER },
          ]}
        >
          <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
            {t.phone.vaults}
          </Text>
          <ScrollView>
            {(app.registry.vaults.value ?? []).map(vault => {
              const current = vault.vaultKey === session.vaultKey;
              return (
                <Pressable
                  key={vault.vaultKey}
                  testID="switch-vault"
                  accessibilityRole="link"
                  accessibilityState={{ selected: current }}
                  onPress={() => {
                    close();
                    if (!current) {
                      router.replace(paths.vault(vault.vaultKey));
                    }
                  }}
                  style={[styles.entry, current && { backgroundColor: palette.bgCard }]}
                >
                  <Text numberOfLines={1} style={[styles.label, { color: palette.fg }]}>
                    {vault.name}
                  </Text>
                  {current && <SyncChip cloud={session.cloud} />}
                  {!current && vault.description.length > 0 && (
                    <Text numberOfLines={1} style={[styles.detail, { color: palette.fgDim }]}>
                      {vault.description}
                    </Text>
                  )}
                </Pressable>
              );
            })}
            <Pressable
              testID="all-vaults"
              accessibilityRole="link"
              onPress={() => {
                close();
                router.dismissTo(paths.start());
              }}
              style={styles.entry}
            >
              <Text style={[styles.label, { color: palette.accent }]}>{t.phone.allVaults}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
});

const SHEET_MAX_SHARE = '70%';

const styles = StyleSheet.create({
  touch: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontSize: TEXT_SIZE.body, fontWeight: '700' },
  dot: {
    position: 'absolute',
    top: (TOUCH_SIZE - AVATAR_SIZE) / 2,
    right: (TOUCH_SIZE - AVATAR_SIZE) / 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
  },
  scrim: { flex: 1 },
  sheet: {
    maxHeight: SHEET_MAX_SHARE,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    paddingTop: GUTTER,
  },
  title: {
    fontSize: TEXT_SIZE.heading,
    fontWeight: '600',
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
  },
  entry: { minHeight: TOUCH_SIZE, justifyContent: 'center', paddingHorizontal: GUTTER, gap: 2 },
  label: { fontSize: TEXT_SIZE.body },
  detail: { fontSize: TEXT_SIZE.small },
});
