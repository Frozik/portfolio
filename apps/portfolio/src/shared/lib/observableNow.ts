import { nowEpochMs } from '@frozik/utils/date/now';
import { isNil } from 'lodash-es';
import type { IAtom } from 'mobx';
import { createAtom } from 'mobx';

const tickerAtoms = new Map<number, IAtom>();

/**
 * Reactive clock: returns the current epoch milliseconds and, when called
 * inside a MobX derivation, re-triggers that derivation every `intervalMs`.
 * Replacement for `now()` from `mobx-utils`, which is unmaintained under
 * MobX 7. Atoms are shared per interval and stop ticking while unobserved.
 */
export function observableNow(intervalMs: number): number {
  let atom = tickerAtoms.get(intervalMs);
  if (isNil(atom)) {
    let timer: ReturnType<typeof setInterval> | null = null;
    const createdAtom = createAtom(
      `observableNow(${intervalMs})`,
      () => {
        timer = setInterval(() => createdAtom.reportChanged(), intervalMs);
      },
      () => {
        if (!isNil(timer)) {
          clearInterval(timer);
          timer = null;
        }
      }
    );
    tickerAtoms.set(intervalMs, createdAtom);
    atom = createdAtom;
  }
  atom.reportObserved();
  return nowEpochMs();
}
