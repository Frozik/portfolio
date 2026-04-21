/**
 * Write `text` to the system clipboard.
 *
 * We prefer the async Clipboard API (`navigator.clipboard.writeText`) as
 * it is the modern supported path; a legacy `document.execCommand('copy')`
 * fallback keeps the feature working in WebView contexts and HTTP dev
 * setups where the Clipboard API is unavailable.
 *
 * Resolves `true` when the write succeeded, `false` otherwise — never
 * throws, so callers can surface a single user-facing error branch.
 */
export async function writeTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !isNilClipboard(navigator.clipboard)) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy fallback — browsers occasionally reject
      // writes when the document does not have focus or the permission
      // has not been granted.
    }
  }

  return writeTextViaExecCommand(text);
}

/**
 * Copy an arbitrary blob (e.g. an exported .md file) to the clipboard as
 * a downloadable URL. Resolves the object URL so the caller can trigger
 * a download anchor. The caller owns URL lifetime and must call
 * `URL.revokeObjectURL()` when done.
 */
export function createDownloadUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Trigger the browser's file-download flow for a given payload.
 *
 * Creates an invisible `<a download>` element, clicks it, and cleans up
 * after the download has started. The generated object URL is revoked
 * asynchronously so Safari has a chance to finish reading it.
 */
export function downloadFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = createDownloadUrl(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Delay revocation so Safari can pick up the navigation.
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
}

const URL_REVOKE_DELAY_MS = 2_000;

function isNilClipboard(clipboard: Clipboard | undefined): clipboard is undefined {
  return typeof clipboard === 'undefined' || clipboard === null;
}

function writeTextViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';

  document.body.appendChild(textarea);

  const previousSelection = document.getSelection();
  const previousRange =
    previousSelection !== null && previousSelection.rangeCount > 0
      ? previousSelection.getRangeAt(0)
      : null;

  textarea.select();

  let succeeded = false;

  try {
    succeeded = document.execCommand('copy');
  } catch {
    succeeded = false;
  }

  document.body.removeChild(textarea);

  if (previousRange !== null && previousSelection !== null) {
    previousSelection.removeAllRanges();
    previousSelection.addRange(previousRange);
  }

  return succeeded;
}
