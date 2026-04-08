import { useWakeLock } from '@frozik/components';
import { useEffect } from 'react';

export function usePreventScreensaver() {
  const { request, release } = useWakeLock();

  useEffect(() => {
    void request();
    return () => void release();
  }, [request, release]);
}
