export function getIsHosted(): boolean {
  return window.location.hostname.endsWith('github.io');
}
