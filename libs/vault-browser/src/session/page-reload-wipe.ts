import type { IProcessWipe, IWipeNote } from '@frozik/vault-app/session/domain/ports/process-wipe';
import { lockReasonFromNote, wipeNoteText } from '@frozik/vault-app/session/domain/wipe-note';

const NOTE_KEY = 'vault:wiped';

/** `false` when site data is blocked: the reloaded page then simply does not say why. */
function remember(note: IWipeNote): boolean {
  try {
    sessionStorage.setItem(NOTE_KEY, wipeNoteText(note));
    return true;
  } catch {
    return false;
  }
}

/**
 * The lock's reload: a new document, so nothing of the session survives in
 * memory. The note waits in this tab's `sessionStorage` for the next page.
 */
export const PAGE_RELOAD_WIPE: IProcessWipe = {
  wipe(note) {
    remember(note);
    window.location.reload();
  },
  takeNote(vaultKey) {
    try {
      const stored = sessionStorage.getItem(NOTE_KEY);
      sessionStorage.removeItem(NOTE_KEY);
      return lockReasonFromNote(stored, vaultKey);
    } catch {
      return null;
    }
  },
};
