import { Temporal } from 'temporal-polyfill';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { ensureBrowserGlobalsForPdfKit } from '../../../../shared/lib/pdf/pdfkit-globals';
import type { TRenderEmergencyKit } from '../../domain/ports/emergency-kit';
import { keysT } from '../translations/keys';

const PDF_MIME = 'application/pdf';
const VAULT_ROUTE = 'vault';

/**
 * The PDF for a key just made, in the page's
 * language. `@react-pdf/renderer` and the QR encoder load only now.
 */
export function createEmergencyKitRenderer({
  vaultName,
  location,
}: {
  readonly vaultName: string;
  readonly location: string;
}): TRenderEmergencyKit {
  return async recoveryKey => {
    ensureBrowserGlobalsForPdfKit();
    const [{ pdf }, { EmergencyKitDocument }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./EmergencyKitDocument'),
    ]);
    const kit = {
      vaultName,
      location,
      recoveryKey,
      createdOn: Temporal.Now.plainDateISO().toLocaleString(getCurrentLanguage(), {
        dateStyle: 'long',
      }),
      siteAddress: `${window.location.origin}${import.meta.env.BASE_URL}${VAULT_ROUTE}`,
      texts: keysT.kit,
    };
    const blob = await pdf(<EmergencyKitDocument kit={kit} />).toBlob();
    return {
      name: `${vaultName} — ${keysT.kit.title}.pdf`,
      mime: PDF_MIME,
      bytes: new Uint8Array(await blob.arrayBuffer()),
    };
  };
}
