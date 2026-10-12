import { multilineHeight } from './multiline-height';

const BOX = { lineHeight: 20, paddingY: 12, borderY: 2, maxRows: 4 };

describe('multilineHeight', () => {
  it('fits one line with its padding and border, and does not scroll', () => {
    expect(multilineHeight({ ...BOX, scrollHeight: 32 })).toEqual({
      height: 34,
      overflows: false,
    });
  });

  it('grows with the text up to the row limit without scrolling', () => {
    expect(multilineHeight({ ...BOX, scrollHeight: 92 })).toEqual({
      height: 94,
      overflows: false,
    });
  });

  it('stops at the row limit and scrolls only past it', () => {
    expect(multilineHeight({ ...BOX, scrollHeight: 112 })).toEqual({
      height: 94,
      overflows: true,
    });
  });

  it('grows without a limit when the line height is unknown', () => {
    expect(multilineHeight({ ...BOX, lineHeight: 0, scrollHeight: 500 })).toEqual({
      height: 502,
      overflows: false,
    });
  });
});
