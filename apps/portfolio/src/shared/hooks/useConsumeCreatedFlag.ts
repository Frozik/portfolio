import { useFunction } from '@frozik/components/hooks/useFunction';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const CREATED_QUERY_FLAG = 'created';
const CREATED_QUERY_VALUE = '1';

/**
 * Read-once handler for the `?created=1` query flag that lobbies append when
 * navigating into a freshly created room. On the first render where the flag is
 * present it runs `onConsume` (typically "open the share dialog") and then strips
 * the flag from the URL via `replace`, so a reload or back-navigation does not
 * re-trigger the effect.
 */
export function useConsumeCreatedFlag(onConsume: () => void): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const consume = useFunction(onConsume);

  useEffect(() => {
    if (searchParams.get(CREATED_QUERY_FLAG) !== CREATED_QUERY_VALUE) {
      return;
    }
    consume();
    const next = new URLSearchParams(searchParams);
    next.delete(CREATED_QUERY_FLAG);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, consume]);
}
