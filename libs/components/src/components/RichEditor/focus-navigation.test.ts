import { findNextTabStop } from './focus-navigation';

function buildButtons(...ids: readonly string[]): readonly HTMLButtonElement[] {
  document.body.innerHTML = '';
  return ids.map(id => {
    const button = document.createElement('button');
    button.id = id;
    document.body.appendChild(button);
    return button;
  });
}

describe('findNextTabStop', () => {
  it('returns the next focusable element in document order', () => {
    const [first] = buildButtons('first', 'second');

    expect(findNextTabStop(first)?.id).toBe('second');
  });

  it('wraps around to the first focusable element after the last one', () => {
    const [, second] = buildButtons('first', 'second');

    expect(findNextTabStop(second)?.id).toBe('first');
  });

  it('skips a disabled editor and a disabled button', () => {
    const [first] = buildButtons('first', 'second');
    const disabledEditor = document.createElement('div');
    disabledEditor.setAttribute('contenteditable', 'false');
    const disabledButton = document.createElement('button');
    disabledButton.disabled = true;
    first.after(disabledEditor, disabledButton);

    expect(findNextTabStop(first)?.id).toBe('second');
  });

  it('has no answer when the anchor is the only stop', () => {
    const [only] = buildButtons('only');

    expect(findNextTabStop(only)).toBeUndefined();
  });
});
