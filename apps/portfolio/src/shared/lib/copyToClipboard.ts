/**
 * Copy `text` to the clipboard via the async Clipboard API. Returns whether
 * the write succeeded — it can fail when the document is not focused or the
 * permission is denied (e.g. inside a sandboxed iframe).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
