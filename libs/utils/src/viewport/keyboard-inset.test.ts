import { followKeyboardInset, KEYBOARD_INSET } from './keyboard-inset';

const WINDOW_HEIGHT = 800;

function aVisualViewport(height: number) {
  return Object.assign(new EventTarget(), { height, offsetTop: 0 });
}

describe('the keyboard inset', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows the part of the window the keyboard covers, and clears when stopped', () => {
    const viewport = aVisualViewport(WINDOW_HEIGHT);
    vi.stubGlobal('visualViewport', viewport);
    vi.stubGlobal('innerHeight', WINDOW_HEIGHT);
    const root = document.createElement('div');
    const stop = followKeyboardInset(root);
    const closed = root.style.getPropertyValue(KEYBOARD_INSET);

    viewport.height = WINDOW_HEIGHT - 300;
    viewport.dispatchEvent(new Event('resize'));
    const open = root.style.getPropertyValue(KEYBOARD_INSET);
    stop();

    expect([closed, open]).toEqual(['0px', '300px']);
    expect(root.style.getPropertyValue(KEYBOARD_INSET)).toBe('');
  });
});
