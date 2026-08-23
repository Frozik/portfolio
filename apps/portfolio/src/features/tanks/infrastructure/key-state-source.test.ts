import { beforeEach, describe, expect, it } from 'vitest';

import { KeyStateSource } from './key-state-source';

function pressKey(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));
}

function releaseKey(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

describe('KeyStateSource', () => {
  let source: KeyStateSource;

  beforeEach(() => {
    source = new KeyStateSource();

    return () => source.dispose();
  });

  it('reports no input while nothing is held', () => {
    expect(source.read()).toEqual({ direction: undefined, fire: false });
  });

  it('maps arrows and WASD to the same directions', () => {
    pressKey('ArrowLeft');
    expect(source.read().direction).toBe('left');

    releaseKey('ArrowLeft');
    pressKey('KeyD');
    expect(source.read().direction).toBe('right');
  });

  it('lets the last pressed direction win', () => {
    pressKey('ArrowUp');
    pressKey('ArrowRight');

    expect(source.read().direction).toBe('right');
  });

  it('falls back to a still-held direction when the last one is released', () => {
    pressKey('ArrowUp');
    pressKey('ArrowRight');
    releaseKey('ArrowRight');

    expect(source.read().direction).toBe('up');
  });

  it('raises the fire edge on press and repeats it every eight ticks', () => {
    pressKey('Space');

    const fireTicks = Array.from({ length: 17 }, () => source.read().fire);

    expect(fireTicks[0]).toBe(true);
    expect(fireTicks.slice(1, 8).some(Boolean)).toBe(false);
    expect(fireTicks[8]).toBe(true);
    expect(fireTicks[16]).toBe(true);
  });

  it('re-arms the fire edge after the key is released', () => {
    pressKey('Space');
    source.read();
    source.read();
    releaseKey('Space');
    expect(source.read().fire).toBe(false);

    pressKey('Space');
    expect(source.read().fire).toBe(true);
  });

  it('clears held keys when the window loses focus', () => {
    pressKey('ArrowUp');
    pressKey('Space');
    window.dispatchEvent(new Event('blur'));

    expect(source.read()).toEqual({ direction: undefined, fire: false });
  });

  it('stops tracking keys after dispose', () => {
    source.dispose();
    pressKey('ArrowUp');

    expect(source.read().direction).toBeUndefined();
  });

  it('leaves the keys to a form control the player is typing in', () => {
    const input = document.createElement('input');

    document.body.append(input);

    const event = new KeyboardEvent('keydown', {
      code: 'ArrowUp',
      bubbles: true,
      cancelable: true,
    });

    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(source.read().direction).toBeUndefined();

    input.remove();
  });

  it('prevents the browser default for game keys only', () => {
    const gameKeyEvent = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    const otherKeyEvent = new KeyboardEvent('keydown', { code: 'KeyQ', cancelable: true });

    window.dispatchEvent(gameKeyEvent);
    window.dispatchEvent(otherKeyEvent);

    expect(gameKeyEvent.defaultPrevented).toBe(true);
    expect(otherKeyEvent.defaultPrevented).toBe(false);
  });
});
