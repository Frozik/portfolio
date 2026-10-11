import { downloadBlob } from '../../../../shared/lib/downloadFile';
import { ensureBrowserGlobalsForPdfKit } from '../../../../shared/lib/pdf/pdfkit-globals';

const PDF_FILE_NAME = 'dmitry-sharov-cv.pdf';

export async function downloadCvPdf(): Promise<void> {
  ensureBrowserGlobalsForPdfKit();
  const [{ pdf }, { CvDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./CvDocument'),
  ]);
  downloadBlob(PDF_FILE_NAME, await pdf(<CvDocument />).toBlob());
}
