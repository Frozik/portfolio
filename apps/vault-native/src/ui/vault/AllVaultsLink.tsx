import { useRouter } from 'expo-router';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { BackLink } from '../kit/BackLink';
import { useVaultTexts } from '../texts';

const paths = createVaultPaths('');

/** A locked vault's way back to the others: the start screen it came from, or a fresh one. */
export function AllVaultsLink() {
  const router = useRouter();
  const label = useVaultTexts().phone.allVaults;
  return (
    <BackLink testID="all-vaults" label={label} onPress={() => router.dismissTo(paths.start())} />
  );
}
