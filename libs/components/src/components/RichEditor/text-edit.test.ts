import { applyTextEdit, textEditFromInput, toSingleLine } from './text-edit';

describe('textEditFromInput', () => {
  it('inserts typed text over the target range', () => {
    expect(
      textEditFromInput({ inputType: 'insertText', data: '5', targetRange: { start: 1, end: 3 } })
    ).toEqual({ start: 1, end: 3, text: '5' });
  });

  it('flattens pasted lines into one', () => {
    expect(
      textEditFromInput({
        inputType: 'insertFromPaste',
        data: 'a\r\nb\nc',
        targetRange: { start: 0, end: 0 },
      })
    ).toEqual({ start: 0, end: 0, text: 'a b c' });
  });

  it('orders a backward target range', () => {
    expect(
      textEditFromInput({ inputType: 'insertText', data: 'x', targetRange: { start: 3, end: 1 } })
    ).toEqual({ start: 1, end: 3, text: 'x' });
  });

  it('deletes the character before a collapsed caret on backspace', () => {
    expect(
      textEditFromInput({
        inputType: 'deleteContentBackward',
        data: undefined,
        targetRange: { start: 2, end: 2 },
      })
    ).toEqual({ start: 1, end: 2, text: '' });
  });

  it('deletes nothing on backspace at the start', () => {
    expect(
      textEditFromInput({
        inputType: 'deleteContentBackward',
        data: undefined,
        targetRange: { start: 0, end: 0 },
      })
    ).toEqual({ start: 0, end: 0, text: '' });
  });

  it('deletes the character after a collapsed caret on delete', () => {
    expect(
      textEditFromInput({
        inputType: 'deleteContentForward',
        data: undefined,
        targetRange: { start: 2, end: 2 },
      })
    ).toEqual({ start: 2, end: 3, text: '' });
  });

  it('deletes exactly the target range for word and cut deletions', () => {
    expect(
      textEditFromInput({
        inputType: 'deleteWordBackward',
        data: undefined,
        targetRange: { start: 2, end: 5 },
      })
    ).toEqual({ start: 2, end: 5, text: '' });
  });

  it('ignores line breaks, formatting and history', () => {
    for (const inputType of ['insertParagraph', 'insertLineBreak', 'formatBold', 'historyUndo']) {
      expect(
        textEditFromInput({ inputType, data: undefined, targetRange: { start: 0, end: 0 } })
      ).toBeUndefined();
    }
  });
});

describe('applyTextEdit', () => {
  it('replaces the range and puts the caret after the inserted text', () => {
    expect(applyTextEdit('12345', { start: 1, end: 3, text: 'ab' })).toEqual({
      value: '1ab45',
      selection: { start: 3, end: 3 },
    });
  });
});

describe('toSingleLine', () => {
  it('turns non-breaking spaces the browser inserts into plain spaces', () => {
    expect(toSingleLine('1 2')).toBe('1 2');
  });
});
