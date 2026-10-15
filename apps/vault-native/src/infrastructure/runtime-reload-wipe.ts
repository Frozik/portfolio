import type { IProcessWipe } from '@frozik/vault-app/session/domain/ports/process-wipe';
import {
  lockReasonFromNote,
  vaultKeyOfNote,
  wipeNoteText,
} from '@frozik/vault-app/session/domain/wipe-note';
import { reloadAppAsync } from 'expo';
import { Storage } from 'expo-sqlite/kv-store';
import { BackHandler } from 'react-native';

const NOTE_KEY = 'vault:wiped';

/**
 * The lock's wipe: a new JavaScript runtime, so nothing of the session stays
 * reachable. The note waits in the app's settings store for the next runtime.
 */
export const RUNTIME_RELOAD_WIPE: IProcessWipe = {
  wipe(note) {
    Storage.setItemSync(NOTE_KEY, wipeNoteText(note));
    reloadAppAsync('vault locked').catch(() => BackHandler.exitApp());
  },
  takeNote(vaultKey) {
    const stored = Storage.getItemSync(NOTE_KEY);
    Storage.removeItemSync(NOTE_KEY);
    return lockReasonFromNote(stored, vaultKey);
  },
};

/** This runtime's launch, given once, with the vault the last lock closed; its unlock takes the note itself. */
export function takeLaunchOnStart(): () => { readonly locked: string | null } | null {
  let launch: { readonly locked: string | null } | null = {
    locked: vaultKeyOfNote(Storage.getItemSync(NOTE_KEY)),
  };
  return () => {
    const taken = launch;
    launch = null;
    return taken;
  };
}
