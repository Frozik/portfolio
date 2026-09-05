import type { ISelection } from './defs';
import { getElementSelection, rangeToSelection, setElementSelection } from './selection';

const caretAt = (offset: number): ISelection => ({ start: offset, end: offset });

function buildEditor(parts: readonly { tag: 'span' | 'text'; text: string }[]): HTMLDivElement {
  document.body.innerHTML = '';

  const editor = document.createElement('div');
  editor.setAttribute('contenteditable', 'true');
  editor.tabIndex = 0;

  for (const part of parts) {
    if (part.tag === 'span') {
      const span = document.createElement('span');
      span.textContent = part.text;
      editor.appendChild(span);
    } else {
      editor.appendChild(document.createTextNode(part.text));
    }
  }

  document.body.appendChild(editor);
  editor.focus();

  return editor;
}

function selectDomRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const selection = document.getSelection();
  if (selection === null) {
    throw new Error('selection unavailable');
  }
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(range);
}

describe('getElementSelection', () => {
  it('has no selection while the editor is not focused', () => {
    const editor = buildEditor([{ tag: 'text', text: '12' }]);
    editor.blur();
    document.body.focus();

    expect(getElementSelection(editor)).toBeUndefined();
  });

  it('counts characters across span and text nodes', () => {
    const editor = buildEditor([
      { tag: 'span', text: '12' },
      { tag: 'text', text: '34' },
    ]);
    const span = editor.querySelector('span');
    const trailing = editor.lastChild;
    if (span?.firstChild == null || trailing == null) {
      throw new Error('fixture not built');
    }

    selectDomRange(span.firstChild, 1, trailing, 1);

    expect(getElementSelection(editor)).toEqual({ start: 1, end: 3 });
  });

  it('understands a caret anchored on the editor element itself', () => {
    const editor = buildEditor([
      { tag: 'span', text: '12' },
      { tag: 'text', text: '34' },
    ]);

    selectDomRange(editor, 1, editor, 1);

    expect(getElementSelection(editor)).toEqual(caretAt(2));
  });
});

describe('setElementSelection', () => {
  it('round-trips through getElementSelection across text nodes', () => {
    const editor = buildEditor([
      { tag: 'span', text: '12' },
      { tag: 'text', text: '34' },
    ]);

    setElementSelection(editor, { start: 1, end: 3 });

    expect(getElementSelection(editor)).toEqual({ start: 1, end: 3 });
  });

  it('places a collapsed caret at the requested offset', () => {
    const editor = buildEditor([
      { tag: 'span', text: '12' },
      { tag: 'text', text: '34' },
    ]);

    setElementSelection(editor, caretAt(2));

    expect(getElementSelection(editor)).toEqual(caretAt(2));
  });

  it('clamps an offset past the end to the end', () => {
    const editor = buildEditor([{ tag: 'text', text: '12' }]);

    setElementSelection(editor, caretAt(10));

    expect(getElementSelection(editor)).toEqual(caretAt(2));
  });

  it('does nothing while the editor is not focused', () => {
    const editor = buildEditor([{ tag: 'text', text: '12' }]);
    editor.blur();
    document.body.focus();

    setElementSelection(editor, { start: 0, end: 2 });

    expect(getElementSelection(editor)).toBeUndefined();
  });
});

describe('rangeToSelection', () => {
  it('maps a range inside the editor to character offsets', () => {
    const editor = buildEditor([
      { tag: 'span', text: '12' },
      { tag: 'text', text: '34' },
    ]);
    const trailing = editor.lastChild;
    if (trailing == null) {
      throw new Error('fixture not built');
    }
    const range = document.createRange();
    range.setStart(editor, 1);
    range.setEnd(trailing, 2);

    expect(rangeToSelection(editor, range)).toEqual({ start: 2, end: 4 });
  });

  it('has no answer for a range outside the editor', () => {
    const editor = buildEditor([{ tag: 'text', text: '12' }]);
    const range = document.createRange();
    range.setStart(document.body, 0);
    range.setEnd(document.body, 0);

    expect(rangeToSelection(editor, range)).toBeUndefined();
  });
});
