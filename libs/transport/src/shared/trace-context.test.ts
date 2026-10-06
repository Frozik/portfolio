import { formatTraceparent, newTraceContext, parseTraceparent } from './trace-context';

describe('W3C trace context', () => {
  it('reads back the traceparent it writes', () => {
    const trace = newTraceContext();

    expect(formatTraceparent(trace)).toMatch(/^00-[\da-f]{32}-[\da-f]{16}-01$/);
    expect(parseTraceparent(formatTraceparent(trace))).toEqual(trace);
  });

  it('starts a different trace every time', () => {
    expect(newTraceContext().traceId).not.toBe(newTraceContext().traceId);
  });

  it('accepts a later version and other flags from another tracer', () => {
    expect(parseTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00')).toEqual({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
    });
  });

  it.each([
    ['nothing', null],
    ['uppercase hex', '00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01'],
    ['the forbidden version', 'ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'],
    ['an all-zero trace id', '00-00000000000000000000000000000000-00f067aa0ba902b7-01'],
    ['an all-zero span id', '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01'],
    ['a short trace id', '00-4bf92f3577b34da6a3ce929d0e0e47-00f067aa0ba902b7-01'],
  ])('ignores %s', (_, value) => {
    expect(parseTraceparent(value)).toBeUndefined();
  });
});
