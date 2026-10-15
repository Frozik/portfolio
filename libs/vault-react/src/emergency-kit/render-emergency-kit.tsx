import { Temporal } from 'temporal-polyfill';

import { ensureBrowserGlobalsForPdfKit } from '@frozik/components/pdf/pdfkit-globals';
import type { TRenderEmergencyKit } from '@frozik/vault-app/keys/domain/ports/emergency-kit';
import { keysT } from '../texts/keys';
import { LANGUAGE } from '../texts/language';

const PDF_MIME = 'application/pdf';

/**
 * The PDF for a key just made, in the page's
 * language. `@react-pdf/renderer` and the QR encoder load only now.
 */
export function createEmergencyKitRenderer({
  vaultName,
  location,
  siteAddress,
}: {
  readonly vaultName: string;
  readonly location: string;
  /** Where the vault opens again: printed on the kit. */
  readonly siteAddress: string;
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
      createdOn: Temporal.Now.plainDateISO().toLocaleString(LANGUAGE, {
        dateStyle: 'long',
      }),
      siteAddress,
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
