const URL_REVOKE_DELAY_MS = 2_000;

/**
 * Trigger the browser's file-download flow for a given payload.
 *
 * Creates an invisible `<a download>` element, clicks it, and cleans up
 * after the download has started. The generated object URL is revoked
 * asynchronously so Safari has a chance to finish reading it.
 */
export function downloadFile(filename: string, contents: string, mimeType: string): void {
  downloadBlob(filename, new Blob([contents], { type: mimeType }));
}

/**
 * The same download flow for a payload that was never text — an image encoded
 * by `canvas.toBlob`, for instance, which has no string form to go through.
 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
}
