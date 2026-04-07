import { assert } from './assert';

describe('assert', () => {
  it('does not throw when condition is true', () => {
    expect(() => assert(true)).not.toThrow();
  });

  it('throws Error when condition is false', () => {
    expect(() => assert(false)).toThrow(Error);
  });

  it('throws with default message when no message provided', () => {
    expect(() => assert(false)).toThrow('assertion failed');
  });

  it('throws with custom message', () => {
    expect(() => assert(false, 'custom message')).toThrow('custom message');
  });
});
