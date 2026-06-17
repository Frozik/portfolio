import { useFunction } from '@frozik/components/hooks/useFunction';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';

import { CONTACT_LINKS } from '../../contentData';
import { welcomeT } from '../../translations';
import type { IContactQRRequest } from './ContactRow';
import { ContactRow } from './ContactRow';
import { QRContactModal } from './QRContactModal';

const ContactListComponent = ({
  className,
  children,
}: {
  readonly className?: string;
  readonly children?: ReactNode;
}) => {
  const [qrRequest, setQrRequest] = useState<IContactQRRequest | null>(null);

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

      <QRContactModal
        open={qrRequest !== null}
        value={qrRequest?.value ?? ''}
        title={qrRequest?.title ?? ''}
        onClose={handleQRClose}
      />
    </>
  );
};

export const ContactList = memo(ContactListComponent);
