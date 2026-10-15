import { Buffer } from 'buffer';

/** PDFKit reads these Node globals at render time; a workaround until it stops needing them. */
export function ensureBrowserGlobalsForPdfKit(): void {
  if (!('Buffer' in globalThis)) {
    Object.assign(globalThis, { Buffer });
  }
  if (!('process' in globalThis)) {
    Object.assign(globalThis, { process: { env: {} } });
  }
}
