import { joinChunks, pointsFor, validatePlotView } from './plot';

const LIMITS = { expressionMaxLength: 10, sampleMaxPoints: 100 } as const;
const VALID = { expression: 'x^2', xMin: -1, xMax: 1 } as const;

describe('plot view', () => {
  it('accepts a sensible view', () => {
    expect(validatePlotView(VALID, LIMITS)).toBeUndefined();
  });

  it('names what is wrong before anything is sent', () => {
    expect(validatePlotView({ ...VALID, expression: '  ' }, LIMITS)).toBe('expression-empty');
    expect(validatePlotView({ ...VALID, expression: 'x'.repeat(11) }, LIMITS)).toBe(
      'expression-too-long'
    );
    expect(validatePlotView({ ...VALID, xMin: 1, xMax: 1 }, LIMITS)).toBe('invalid-range');
    expect(validatePlotView({ ...VALID, xMax: Number.NaN }, LIMITS)).toBe('invalid-range');
  });
});

describe('plot density', () => {
  it('takes one point per ten physical pixels', () => {
    expect(pointsFor(600, 1, 1000)).toBe(60);
    expect(pointsFor(600, 2, 1000)).toBe(120);
    expect(pointsFor(601, 1, 1000)).toBe(61);
  });

  it('stays within what the server allows and never below a line', () => {
    expect(pointsFor(100_000, 2, 1000)).toBe(1000);
    expect(pointsFor(1, 1, 1000)).toBe(2);
  });
});

describe('plot curve', () => {
  it('joins streamed chunks in order', () => {
    const curve = joinChunks([
      { x: [0, 1], y: [5, 6] },
      { x: [2], y: [Number.NaN] },
    ]);
    expect(curve.x).toEqual([0, 1, 2]);
    expect(curve.y[2]).toBeNaN();
  });
});
