import { Alert, Linking } from 'react-native';

import { useVaultTexts } from './texts';

/** An address handed to the phone; one no app takes says so instead of doing nothing. */
export function useOpenLink(): (url: string) => void {
  const failed = useVaultTexts().phone.linkFailed;
  return url => void Linking.openURL(url).catch(() => Alert.alert(failed));
}
