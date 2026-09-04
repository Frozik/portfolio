// biome-ignore lint/style/useNodejsImportProtocol: the npm `buffer` polyfill for the browser, not the Node builtin (see CLAUDE.md, Known Architectural Debt)
import { Buffer } from 'buffer';

import { downloadBlob } from '../../../../shared/lib/downloadFile';

const PDF_FILE_NAME = 'dmitry-sharov-cv.pdf';

/** PDFKit reads these Node globals at render time; recorded as debt in CLAUDE.md. */
function ensureBrowserGlobalsForPdfKit(): void {
  if (!('Buffer' in globalThis)) {
    Object.assign(globalThis, { Buffer });
  }
  if (!('process' in globalThis)) {
    Object.assign(globalThis, { process: { env: {} } });
  }
}

export async function downloadCvPdf(): Promise<void> {
  ensureBrowserGlobalsForPdfKit();
  const [{ pdf }, { CvDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./CvDocument'),
  ]);
  downloadBlob(PDF_FILE_NAME, await pdf(<CvDocument />).toBlob());
}
