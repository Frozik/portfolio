import type { ISelection } from './defs';
import styles from './styles.module.scss';
import {
  findNextTabStop,
  getElementSelection,
  isParentOf,
  numericElementSelectionWithValueBuilder,
  numericTextToHtmlBuilder,
  setElementSelection,
  traverseTextNodes,
} from './utils';

const collapsedSelection = (offset: number): ISelection => ({ start: offset, end: offset });

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

describe('numericElementSelectionWithValueBuilder — fast-input suffix expansion', () => {
  const apply = numericElementSelectionWithValueBuilder({});

  function run(newValue: string) {
    return apply({
      oldValue: '',
      newValue,
      oldSelection: collapsedSelection(0),
      newSelection: collapsedSelection(newValue.length),
    });
  }

  it('expands a "k" suffix into three trailing zeros', () => {
    expect(run('1k')).toEqual({ value: '1000', selection: collapsedSelection(4) });
  });

  it('expands a "m" suffix into six trailing zeros', () => {
    expect(run('2m')).toEqual({ value: '2000000', selection: collapsedSelection(7) });
  });

  it('expands a "b" suffix into nine trailing zeros', () => {
    expect(run('3b')).toEqual({ value: '3000000000', selection: collapsedSelection(10) });
  });

  it('treats suffixes case-insensitively', () => {
    expect(run('2K')).toEqual({ value: '2000', selection: collapsedSelection(4) });
  });

  it('expands a suffix appended to a decimal value', () => {
    // The whole "m" is replaced by "000000" and appended after the decimals.
    expect(run('2.5m')).toEqual({ value: '2.5000000', selection: collapsedSelection(9) });
  });

  it('passes plain numeric input through unchanged', () => {
    expect(run('123')).toEqual({ value: '123', selection: collapsedSelection(3) });
  });

  it('rejects more than one suffix character', () => {
    expect(run('1kk')).toBe(false);
  });

  it('rejects non-numeric, non-suffix characters', () => {
    expect(run('12x')).toBe(false);
  });

  it('rejects more than one decimal point', () => {
    expect(run('1.2.3')).toBe(false);
  });

  it('rejects a negative sign when negatives are not allowed', () => {
    expect(run('-5')).toBe(false);
  });

  it('rejects a value whose total digit count exceeds the 50-character limit', () => {
    expect(run('1'.repeat(51))).toBe(false);
  });

  it('rejects a value with more than 15 significant digits', () => {
    expect(run('1234567890123456')).toBe(false);
  });

  it('accepts an empty value', () => {
    expect(
      apply({
        oldValue: '1',
        newValue: '',
        oldSelection: collapsedSelection(1),
        newSelection: collapsedSelection(0),
      })
    ).toEqual({ value: '', selection: collapsedSelection(0) });
  });
});

describe('numericElementSelectionWithValueBuilder — allowNegative', () => {
  const apply = numericElementSelectionWithValueBuilder({ allowNegative: true });

  it('accepts a leading negative sign', () => {
    expect(
      apply({
        oldValue: '',
        newValue: '-5',
        oldSelection: collapsedSelection(0),
        newSelection: collapsedSelection(2),
      })
    ).toEqual({ value: '-5', selection: collapsedSelection(2) });
  });
});

describe('numericTextToHtmlBuilder', () => {
  it('returns an empty string for empty input', () => {
    expect(numericTextToHtmlBuilder({})('', false)).toBe('');
    expect(numericTextToHtmlBuilder({})('', true)).toBe('');
  });

  it('wraps thousands-group boundaries in span elements while editing', () => {
    const html = numericTextToHtmlBuilder({})('1234', true);

    expect(html).toBe(
      `<span class="${styles.groupEnd}">1</span><span class="${styles.groupStart}">2</span>34`
    );
  });

  it('leaves a single group of digits ungrouped', () => {
    expect(numericTextToHtmlBuilder({})('123', true)).toBe('123');
  });

  it('pads the integer part with grouped zeros down to the decimal scale when not editing', () => {
    // decimal=2 produces a fractional part of "00", which has negative positions
    // and therefore receives no grouping classes.
    expect(numericTextToHtmlBuilder({ decimal: 2 })('5', false)).toBe('5.00');
  });

  it('preserves a leading negative sign', () => {
    expect(numericTextToHtmlBuilder({})('-12', true)).toBe('-12');
  });

  it('wraps pip digits in the pip class', () => {
    const html = numericTextToHtmlBuilder({ pipStart: 0, pipSize: 2 })('1', false);

    expect(html).toBe(`<span class="${styles.pip}">1</span>.<span class="${styles.pip}">0</span>0`);
  });
});

describe('traverseTextNodes', () => {
  it('yields every text node in document order, descending into elements', () => {
    const editor = buildEditor([
      { tag: 'span', text: 'ab' },
      { tag: 'text', text: 'cd' },
      { tag: 'span', text: 'ef' },
    ]);

    const texts = Array.from(traverseTextNodes(editor)).map(node => node.textContent);

    expect(texts).toEqual(['ab', 'cd', 'ef']);
  });
});

describe('isParentOf', () => {
  it('returns false for a null element', () => {
    const parent = document.createElement('div');

    expect(isParentOf(null, parent)).toBe(false);
  });

  it('returns true when the element is the parent itself', () => {
    const parent = document.createElement('div');

    expect(isParentOf(parent, parent)).toBe(true);
  });

  it('returns true for a nested descendant', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    const grandChild = document.createElement('b');
    child.appendChild(grandChild);
    parent.appendChild(child);

    expect(isParentOf(grandChild, parent)).toBe(true);
  });

  it('returns false for an unrelated element', () => {
    const parent = document.createElement('div');
    const stranger = document.createElement('div');

    expect(isParentOf(stranger, parent)).toBe(false);
  });
});

describe('getElementSelection', () => {
  it('returns null when the active element is outside the editor', () => {
    const editor = buildEditor([{ tag: 'text', text: '12' }]);
    editor.blur();
    document.body.focus();

    expect(getElementSelection(editor)).toBeNull();
  });

  it('computes the global caret offset across span and text nodes', () => {
    const editor = buildEditor([
      { tag: 'span', text: '12' },
      { tag: 'text', text: '34' },
    ]);

    const span = editor.querySelector('span');
    const trailingTextNode = editor.lastChild;

    if (span?.firstChild == null || trailingTextNode == null) {
      throw new Error('test fixture not constructed correctly');
    }

    const selection = document.getSelection();

    if (selection == null) {
      throw new Error('selection unavailable');
    }

    const range = document.createRange();
    range.setStart(span.firstChild, 1); // global offset 1 (inside "12")
    range.setEnd(trailingTextNode, 1); // global offset 3 (inside "34")
    selection.removeAllRanges();
    selection.addRange(range);

    expect(getElementSelection(editor)).toEqual({ start: 1, end: 3 });
  });
});

describe('setElementSelection', () => {
  it('round-trips with getElementSelection across multiple text nodes', () => {
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

    setElementSelection(editor, collapsedSelection(2));

    expect(getElementSelection(editor)).toEqual(collapsedSelection(2));
  });

  it('does nothing when the active element is outside the editor', () => {
    const editor = buildEditor([{ tag: 'text', text: '12' }]);
    editor.blur();
    document.body.focus();

    setElementSelection(editor, { start: 0, end: 2 });

    expect(getElementSelection(editor)).toBeNull();
  });
});

describe('findNextTabStop', () => {
  it('returns the next focusable element in document order', () => {
    document.body.innerHTML = '';
    const first = document.createElement('button');
    first.id = 'first';
    const second = document.createElement('button');
    second.id = 'second';
    document.body.append(first, second);

    expect(findNextTabStop(first)?.id).toBe('second');
  });

  it('wraps around to the first focusable element after the last one', () => {
    document.body.innerHTML = '';
    const first = document.createElement('button');
    first.id = 'first';
    const second = document.createElement('button');
    second.id = 'second';
    document.body.append(first, second);

    expect(findNextTabStop(second)?.id).toBe('first');
  });
});
