import { useWakeLock } from '@frozik/components/hooks/useWakeLock';
import { useEffect } from 'react';

export function usePreventScreensaver() {
  const { request, release } = useWakeLock();

  useEffect(() => {
    void request();
    return () => void release();
  }, [request, release]);
}
