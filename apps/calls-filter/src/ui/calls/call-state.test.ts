import { callRing } from './call-state';

describe('the ring around a call', () => {
  it('is red for every call that was turned away, a repeat-in-waiting included', () => {
    expect(
      (['rejected', 'awaiting-repeat', 'history-blocked'] as const).map(state =>
        callRing(state, null)
      )
    ).toEqual(['danger', 'danger', 'danger']);
  });

  it('is green for a call that rang and was answered', () => {
    expect(callRing('passed', true)).toBe('positive');
    expect(callRing('history-answered', true)).toBe('positive');
  });

  it('is blue for a call that rang and nobody answered', () => {
    expect(callRing('passed', false)).toBe('accent');
    expect(callRing('passed-as-repeat', false)).toBe('accent');
    expect(callRing('history-missed', false)).toBe('accent');
  });

  it('stays green for a call that rang while the phone has not yet said whether it was answered', () => {
    expect(callRing('passed', null)).toBe('positive');
    expect(callRing('paused', null)).toBe('positive');
  });
});
