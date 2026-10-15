import { Stack, useLocalSearchParams } from 'expo-router';

import { VaultScreen } from '../../ui/vault/VaultScreen';

export default function VaultLayout() {
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();
  return (
    <VaultScreen vaultKey={vaultId}>
      <Stack screenOptions={{ headerShown: false }} />
    </VaultScreen>
  );
}
