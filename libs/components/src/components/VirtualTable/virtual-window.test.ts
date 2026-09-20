import { indexAtOffset, rowOffsets, virtualWindow } from './virtual-window';

const uniform = (count: number, height: number): number[] => new Array(count).fill(height);

describe('rowOffsets', () => {
  it('starts at zero and ends at the total height', () => {
    expect(rowOffsets([10, 20, 30])).toEqual([0, 10, 30, 60]);
  });

  it('describes an empty list as a single zero offset', () => {
    expect(rowOffsets([])).toEqual([0]);
  });
});

describe('indexAtOffset', () => {
  const offsets = rowOffsets([10, 20, 30]);

  it('finds the row an offset falls inside', () => {
    expect(indexAtOffset(offsets, 0)).toBe(0);
    expect(indexAtOffset(offsets, 15)).toBe(1);
    expect(indexAtOffset(offsets, 45)).toBe(2);
  });

  it('treats a row boundary as the start of the next row', () => {
    expect(indexAtOffset(offsets, 10)).toBe(1);
    expect(indexAtOffset(offsets, 30)).toBe(2);
  });

  it('clamps past the end to the last row', () => {
    expect(indexAtOffset(offsets, 10_000)).toBe(2);
  });
});

describe('virtualWindow', () => {
  it('renders nothing for an empty list', () => {
    const window = virtualWindow({ heights: [], scrollTop: 0, viewportHeight: 500 });
    expect(window).toEqual({
      startIndex: 0,
      endIndex: -1,
      offsetBefore: 0,
      offsetAfter: 0,
      totalHeight: 0,
    });
  });

  it('renders the visible rows plus the overscan on both sides', () => {
    const window = virtualWindow({
      heights: uniform(1000, 10),
      scrollTop: 500,
      viewportHeight: 100,
      overscan: 2,
    });
    // rows 50..60 are visible; two rows of overscan on each side.
    expect(window.startIndex).toBe(48);
    expect(window.endIndex).toBe(62);
  });

  it('never asks for a row before the first or past the last', () => {
    const heights = uniform(5, 10);
    const atTop = virtualWindow({ heights, scrollTop: 0, viewportHeight: 30, overscan: 10 });
    expect(atTop.startIndex).toBe(0);
    expect(atTop.endIndex).toBe(4);
  });

  it('accounts for the skipped rows above and below, so the scrollbar stays honest', () => {
    const window = virtualWindow({
      heights: uniform(100, 10),
      scrollTop: 300,
      viewportHeight: 100,
      overscan: 0,
    });
    expect(window.totalHeight).toBe(1000);
    expect(window.offsetBefore).toBe(300);
    expect(
      window.offsetBefore + (window.endIndex - window.startIndex + 1) * 10 + window.offsetAfter
    ).toBe(1000);
  });

  it('follows rows of differing heights rather than assuming one estimate', () => {
    const heights = [100, 10, 10, 10, 100];
    const window = virtualWindow({ heights, scrollTop: 100, viewportHeight: 20, overscan: 0 });
    expect(window.startIndex).toBe(1);
    expect(window.offsetBefore).toBe(100);
  });

  it('treats a negative scroll offset as the top, so overscroll does not blank the list', () => {
    const window = virtualWindow({
      heights: uniform(10, 10),
      scrollTop: -40,
      viewportHeight: 50,
      overscan: 0,
    });
    expect(window.startIndex).toBe(0);
    expect(window.offsetBefore).toBe(0);
  });
});
