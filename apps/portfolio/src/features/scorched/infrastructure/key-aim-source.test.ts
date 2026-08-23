import { afterEach, describe, expect, it } from 'vitest';

import type { KeyAimSource as KeyAimSourceType } from './key-aim-source';
import { KeyAimSource } from './key-aim-source';

let currentSeconds = 0;
let source: KeyAimSourceType | undefined;

function createSource(): KeyAimSourceType {
  currentSeconds = 0;
  source = new KeyAimSource(() => currentSeconds);

  return source;
}

function pressKey(code: string, options: { readonly shiftKey?: boolean } = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true, ...options }));
}

function releaseKey(code: string, options: { readonly shiftKey?: boolean } = {}): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { code, ...options }));
}

afterEach(() => {
  source?.dispose();
  source = undefined;
});

describe('KeyAimSource', () => {
  it('emits one step the moment an arrow goes down', () => {
    const keyAimSource = createSource();

    pressKey('ArrowLeft');

    expect(keyAimSource.read().dialDelta).toBe(1);
  });

  it('holds the step until the repeat delay elapses, then repeats', () => {
    const keyAimSource = createSource();

    pressKey('ArrowRight');
    keyAimSource.read();

    currentSeconds = 0.2;
    expect(keyAimSource.read().dialDelta).toBe(0);

    currentSeconds = 0.4;
    expect(keyAimSource.read().dialDelta).toBe(-3);
  });

  it('turns the dial towards the left on ArrowLeft and the right on ArrowRight', () => {
    const keyAimSource = createSource();

    pressKey('ArrowLeft');
    pressKey('ArrowRight');

    expect(keyAimSource.read().dialDelta).toBe(0);
  });

  it('steps the power by one on the arrows and by ten on the page keys', () => {
    const keyAimSource = createSource();

    pressKey('ArrowUp');
    expect(keyAimSource.read().powerDelta).toBe(1);

    releaseKey('ArrowUp');
    pressKey('PageDown');
    expect(keyAimSource.read().powerDelta).toBe(-10);
  });

  it('trims an arrow step to a tenth while shift is held, leaving the page keys coarse', () => {
    const keyAimSource = createSource();

    pressKey('ArrowUp', { shiftKey: true });
    expect(keyAimSource.read().powerDelta).toBeCloseTo(0.1);

    releaseKey('ArrowUp', { shiftKey: true });
    pressKey('PageUp', { shiftKey: true });
    expect(keyAimSource.read().powerDelta).toBe(10);
  });

  it('reports fire once per press and clears it on read', () => {
    const keyAimSource = createSource();

    pressKey('Space');

    expect(keyAimSource.read().isFireRequested).toBe(true);
    expect(keyAimSource.read().isFireRequested).toBe(false);
  });

  it('ignores the operating system key repeat for fire', () => {
    const keyAimSource = createSource();

    pressKey('Space');
    keyAimSource.read();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true }));

    expect(keyAimSource.read().isFireRequested).toBe(false);
  });

  it('reports a weapon cycle on tab', () => {
    const keyAimSource = createSource();

    pressKey('Tab');

    expect(keyAimSource.read().isWeaponCycleRequested).toBe(true);
  });

  it('drops every held key when the window loses focus', () => {
    const keyAimSource = createSource();

    pressKey('ArrowLeft');
    keyAimSource.read();
    window.dispatchEvent(new Event('blur'));
    currentSeconds = 1;

    expect(keyAimSource.read().dialDelta).toBe(0);
  });

  it('leaves the keys to a form control the player is typing in', () => {
    const keyAimSource = createSource();
    const input = document.createElement('input');

    document.body.append(input);

    const event = new KeyboardEvent('keydown', {
      code: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });

    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(keyAimSource.read().dialDelta).toBe(0);

    input.remove();
  });

  it('leaves fire and weapon cycling to a form control too', () => {
    const keyAimSource = createSource();
    const select = document.createElement('select');

    document.body.append(select);

    for (const code of ['Space', 'Tab']) {
      select.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    }

    const input = keyAimSource.read();

    expect(input.isFireRequested).toBe(false);
    expect(input.isWeaponCycleRequested).toBe(false);

    select.remove();
  });

  it('stops listening once disposed', () => {
    const keyAimSource = createSource();

    keyAimSource.dispose();
    pressKey('ArrowLeft');

    expect(keyAimSource.read().dialDelta).toBe(0);
  });
});
