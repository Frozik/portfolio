/** The lock's reload: a new document, so nothing of the session survives in memory. */
export function reloadPage(): void {
  window.location.reload();
}
