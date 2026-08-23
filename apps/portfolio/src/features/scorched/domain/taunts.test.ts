import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pickTaunt, shouldTaunt } from './taunts';

const { randomMock } = vi.hoisted(() => ({ randomMock: vi.fn<(...args: number[]) => number>() }));

vi.mock('lodash-es', async importOriginal => ({
  ...(await importOriginal<typeof import('lodash-es')>()),
  random: (...args: number[]) => randomMock(...args),
}));

const LINE_COUNT = 10;

beforeEach(() => {
  randomMock.mockReset();
});

describe('shouldTaunt', () => {
  it('never speaks while Talk Probability is off — the option default', () => {
    expect(shouldTaunt(0)).toBe(false);
    expect(randomMock).not.toHaveBeenCalled();
  });

  it('speaks when the draw lands inside the probability', () => {
    randomMock.mockReturnValueOnce(30);

    expect(shouldTaunt(30)).toBe(true);
  });

  it('stays quiet when the draw lands outside it', () => {
    randomMock.mockReturnValueOnce(31);

    expect(shouldTaunt(30)).toBe(false);
  });

  it('always speaks at a hundred percent, whatever the draw', () => {
    randomMock.mockReturnValueOnce(100);

    expect(shouldTaunt(100)).toBe(true);
  });
});

describe('pickTaunt', () => {
  it('returns the drawn line of the requested kind', () => {
    randomMock.mockReturnValueOnce(1).mockReturnValueOnce(7);

    expect(pickTaunt('death', LINE_COUNT, 100)).toEqual({ kind: 'death', lineIndex: 7 });
  });

  it('draws inside the line list it was given', () => {
    randomMock.mockReturnValueOnce(1).mockReturnValueOnce(0);

    pickTaunt('attack', LINE_COUNT, 100);

    expect(randomMock).toHaveBeenLastCalledWith(LINE_COUNT - 1);
  });

  it('says nothing when the roll fails', () => {
    randomMock.mockReturnValueOnce(100);

    expect(pickTaunt('attack', LINE_COUNT, 1)).toBeUndefined();
  });

  it('says nothing when there are no lines to say', () => {
    expect(pickTaunt('attack', 0, 100)).toBeUndefined();
    expect(randomMock).not.toHaveBeenCalled();
  });
});
