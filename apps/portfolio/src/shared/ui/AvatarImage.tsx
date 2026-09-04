import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';

/**
 * Profile picture with a fallback for the cases the URL cannot be shown:
 * no picture at all, or a provider CDN that refuses the request. Google
 * serves restricted profile photos only to a browser holding its cookies,
 * so the same URL renders in one browser and fails in another. The
 * referrer is withheld because the CDNs rate-limit by it.
 */
export const AvatarImage = memo(
  ({
    src,
    alt,
    fallback,
  }: {
    readonly src: string | undefined;
    readonly alt: string;
    readonly fallback: ReactNode;
  }) => {
    const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
    const handleError = useFunction(() => {
      setFailedSrc(src);
    });

    if (isNil(src) || failedSrc === src) {
      return <>{fallback}</>;
    }
    return (
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={handleError}
        className="h-full w-full object-cover"
      />
    );
  }
);
