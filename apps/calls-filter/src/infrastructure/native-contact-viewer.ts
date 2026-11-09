import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { IContactViewer } from '../contexts/device/domain/ports/contact-viewer';

/** Android's contacts provider serves each contact's thumbnail under its `_ID`. */
const CONTACTS_URI = 'content://com.android.contacts/contacts';

export const NATIVE_CONTACT_VIEWER: IContactViewer = {
  open: contactId => CALL_SCREENING.openContact(contactId),
  photoUri: contactId => `${CONTACTS_URI}/${encodeURIComponent(contactId)}/photo`,
};
