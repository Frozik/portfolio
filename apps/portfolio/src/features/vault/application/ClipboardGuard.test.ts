import type { IClipboard } from '../domain/ports/clipboard';
import { ClipboardGuard } from './ClipboardGuard';
import { createFakeSessionClock } from './fake-session-clock.test-helper';

const CLEAR_AFTER_MS = 30_000;

function fakeClipboard() {
  let focused = true;
  const focusListeners = new Set<() => void>();
  const writes: string[] = [];
  const clearsAfterReload: string[] = [];
  const clipboard: IClipboard = {
    clearAfterReload: () => clearsAfterReload.push('pending'),
    write: text => {
      writes.push(text);
      return Promise.resolve(true);
    },
    hasFocus: () => focused,
    onceFocused: listener => {
      focusListeners.add(listener);
      return () => focusListeners.delete(listener);
    },
  };
  return {
    clipboard,
    writes,
    clearsAfterReload,
    blur: () => {
      focused = false;
    },
    focus: () => {
      focused = true;
      const listeners = [...focusListeners];
      focusListeners.clear();
      listeners.forEach(listener => listener());
    },
  };
}

function guard() {
  const time = createFakeSessionClock();
  const fake = fakeClipboard();
  return {
    ...time,
    ...fake,
    guard: new ClipboardGuard(fake.clipboard, time.clock, () => CLEAR_AFTER_MS),
  };
}

describe('ClipboardGuard', () => {
  it('clears a copied secret after thirty seconds and says when', async () => {
    const setup = guard();

    await setup.guard.copy('hunter2');
    expect(setup.guard.clearsAt).toBe(setup.clock.now() + CLEAR_AFTER_MS);
    setup.advance(CLEAR_AFTER_MS);

    expect(setup.writes).toEqual(['hunter2', '']);
    expect(setup.guard.clearsAt).toBeNull();
  });

  it('counts the thirty seconds from the latest copy', async () => {
    const setup = guard();

    await setup.guard.copy('first');
    setup.advance(CLEAR_AFTER_MS / 2);
    await setup.guard.copy('second');
    setup.advance(CLEAR_AFTER_MS / 2);

    expect(setup.writes).toEqual(['first', 'second']);
  });

  it('waits for the focus to come back before clearing', async () => {
    const setup = guard();

    await setup.guard.copy('hunter2');
    setup.blur();
    setup.advance(CLEAR_AFTER_MS);
    expect(setup.writes).toEqual(['hunter2']);

    setup.focus();
    expect(setup.writes).toEqual(['hunter2', '']);
  });

  it('clears at once on lock while the tab has focus', async () => {
    const setup = guard();

    await setup.guard.copy('hunter2');
    setup.guard.flush();

    expect(setup.writes).toEqual(['hunter2', '']);
    expect(setup.pendingTimers()).toBe(0);
  });

  it('hands the clearing over to the reloaded page when the lock comes without focus', async () => {
    const setup = guard();

    await setup.guard.copy('hunter2');
    setup.blur();
    setup.guard.flush();

    expect(setup.writes).toEqual(['hunter2']);
    expect(setup.clearsAfterReload).toEqual(['pending']);
  });
});
