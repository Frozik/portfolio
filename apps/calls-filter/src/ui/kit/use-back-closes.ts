import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * While `open`, the phone's back closes what is open on the screen instead of leaving it, as it
 * closes a sheet. A sheet is a dialog of its own and gets back without this.
 */
export function useBackCloses(open: boolean, close: () => void): void {
  useFocusEffect(
    useCallback(() => {
      if (!open) {
        return undefined;
      }
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => subscription.remove();
    }, [open, close])
  );
}
