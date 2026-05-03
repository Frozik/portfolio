// biome-ignore lint/style/useNodejsImportProtocol: this imports the npm `buffer` polyfill package for the browser (PDFKit needs a global Buffer), not the Node.js builtin — adding `node:` prefix would silently resolve to the unavailable Node builtin in the bundler.
import { Buffer } from 'buffer';

const PDF_FILE_NAME_BASE = 'dmitry-sharov-cv';

interface IPdfKitGlobalsShim {
  Buffer?: typeof Buffer;
  process?: { env: Record<string, string | undefined> };
}

function ensureBrowserGlobalsForPdfKit(): void {
  const target = globalThis as unknown as IPdfKitGlobalsShim;
  if (target.Buffer === undefined) {
    target.Buffer = Buffer;
  }
  if (target.process === undefined) {
    target.process = { env: {} };
  }
}

export async function downloadCvPdf(): Promise<void> {
  ensureBrowserGlobalsForPdfKit();

  const [{ pdf }, { CvDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./CvDocument'),
  ]);

  const blob = await pdf(<CvDocument />).toBlob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${PDF_FILE_NAME_BASE}.pdf`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(objectUrl);
}
