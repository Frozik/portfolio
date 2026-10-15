import type { IProcessWipe, IWipeNote } from '../session/domain/ports/process-wipe';

/** Counts the wipes a test caused instead of ending the process, and keeps their notes. */
export function createFakeProcessWipe() {
  let wipes = 0;
  let note: IWipeNote | null = null;
  const wipe: IProcessWipe = {
    wipe: next => {
      wipes += 1;
      note = next;
    },
    takeNote: vaultKey => {
      const taken = note?.vaultKey === vaultKey ? note.reason : null;
      note = null;
      return taken;
    },
  };
  return { wipe, wipes: () => wipes };
}
