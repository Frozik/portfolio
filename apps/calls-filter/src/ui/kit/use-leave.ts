import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Leaves the screen: back to where the user came from, or to the groups when it was opened by a
 * link and nothing lies behind it — `back()` alone would do nothing there.
 */
export function useLeave(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);
}
