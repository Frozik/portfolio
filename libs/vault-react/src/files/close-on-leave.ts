/**
 * A file opened in a tab of its own is decrypted there,
 * out of reach of the lock's reload. The page keeps the tab's handle and
 * closes it when it goes: every lock reloads, and a reload is a `pagehide`.
 */
export function openClosingOnLeave(url: string): void {
  const tab = window.open(url, '_blank');
  if (tab === null) {
    return;
  }
  window.addEventListener('pagehide', () => tab.close(), { once: true });
}
