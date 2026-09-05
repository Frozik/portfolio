import { useFunction } from '@frozik/components/hooks/useFunction';
import { useMountedOnce } from '@frozik/components/hooks/useMountedOnce';
import type { ReactNode } from 'react';
import { lazy, memo, Suspense, useState } from 'react';

import { CONTACT_LINKS } from '../../contentData';
import { welcomeT } from '../../translations';
import type { IContactQRRequest } from './ContactRow';
import { ContactRow } from './ContactRow';

// The modal is the landing's only user of qrcode.react and the Radix Dialog
// family — loaded on the first QR click, not with the page.
const QRContactModal = lazy(() =>
  import('./QRContactModal').then(m => ({ default: m.QRContactModal }))
);

const ContactListComponent = ({
  className,
  children,
}: {
  readonly className?: string;
  readonly children?: ReactNode;
}) => {
  const [qrRequest, setQrRequest] = useState<IContactQRRequest | null>(null);
  const qrModalMounted = useMountedOnce(qrRequest !== null);

  const handleQRRequest = useFunction((payload: IContactQRRequest) => setQrRequest(payload));
  const handleQRClose = useFunction(() => setQrRequest(null));

  return (
    <>
      <div className={className}>
        {CONTACT_LINKS.map(link => {
          const labels = welcomeT.contacts.entries[link.iconKey];
          return (
            <ContactRow
              key={link.iconKey}
              iconKey={link.iconKey}
              label={labels.label}
              href={link.href}
              qrValue={link.qrValue}
              qrTitle={link.qrValue ? labels.qrTitle : undefined}
              preferred={link.preferred}
              onQRRequest={handleQRRequest}
            />
          );
        })}
        {children}
      </div>

      {qrModalMounted && (
        <Suspense fallback={null}>
          <QRContactModal
            open={qrRequest !== null}
            value={qrRequest?.value ?? ''}
            title={qrRequest?.title ?? ''}
            onClose={handleQRClose}
          />
        </Suspense>
      )}
    </>
  );
};

export const ContactList = memo(ContactListComponent);
