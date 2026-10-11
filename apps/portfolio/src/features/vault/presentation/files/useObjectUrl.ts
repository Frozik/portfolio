import { useEffect, useState } from 'react';

/**
 * A `blob:` URL lives only while something shows it: created
 * for the bytes, revoked when they change or the view goes. The lock reloads
 * the page, so none outlives a session either.
 */
export function useObjectUrl(
  bytes: Uint8Array<ArrayBuffer> | undefined,
  mime: string
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (bytes === undefined) {
      setUrl(null);
      return undefined;
    }
    const created = URL.createObjectURL(new Blob([bytes], { type: mime }));
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [bytes, mime]);
  return url;
}
