import { matchesKey } from './keyboard';

function event(
  key: string,
  modifiers: Partial<Record<'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}
) {
  return {
    key,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...modifiers,
  } as globalThis.KeyboardEvent;
}

describe('matchesKey', () => {
  it('matches a plain key only without modifiers', () => {
    expect(matchesKey('Enter', event('Enter'))).toBe(true);
    expect(matchesKey('Enter', event('Enter', { shiftKey: true }))).toBe(false);
  });

  it('requires every listed modifier', () => {
    expect(matchesKey('Shift+ArrowLeft', event('ArrowLeft', { shiftKey: true }))).toBe(true);
    expect(matchesKey('Shift+ArrowLeft', event('ArrowLeft'))).toBe(false);
  });

  it('treats Mod as either command key', () => {
    expect(matchesKey('Mod+c', event('c', { metaKey: true }))).toBe(true);
    expect(matchesKey('Mod+c', event('c', { ctrlKey: true }))).toBe(true);
    expect(matchesKey('Mod+c', event('c'))).toBe(false);
  });
});
