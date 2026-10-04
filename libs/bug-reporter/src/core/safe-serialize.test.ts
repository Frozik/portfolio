import { describe, expect, it } from 'vitest';

import { describeValue, formatConsoleArguments } from './safe-serialize';

describe('formatConsoleArguments', () => {
  it('prints top-level strings bare and nested strings quoted, like DevTools', () => {
    expect(formatConsoleArguments(['loaded', { name: 'x' }])).toBe('loaded {name: "x"}');
  });

  it('shows an Error with its message and stack instead of an empty object', () => {
    const error = new Error('boom');
    const text = describeValue(error);

    expect(text.startsWith('Error: boom')).toBe(true);
    expect(text).toContain('safe-serialize.test');
  });

  it('follows the cause chain of an Error', () => {
    const error = new Error('outer', { cause: new Error('inner') });
    expect(describeValue(error)).toContain('Caused by: Error: inner');
  });

  it('marks a cycle instead of recursing forever', () => {
    const node: { self?: unknown } = {};
    node.self = node;

    expect(describeValue(node)).toBe('{self: [Circular]}');
  });

  it('describes a DOM node as a selector rather than serialising it', () => {
    const element = document.createElement('button');
    element.id = 'save';
    element.className = 'primary  wide';

    expect(describeValue(element)).toBe('<button#save.primary.wide>');
  });

  it('stops at a fixed depth', () => {
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    expect(describeValue(deep)).toBe('{a: {b: {c: [Object]}}}');
  });

  it('caps long strings and reports their real length', () => {
    const text = describeValue('x'.repeat(5_000));
    expect(text.endsWith('… (5000 chars)')).toBe(true);
    expect(text.length).toBeLessThan(2_100);
  });

  it('survives a getter that throws', () => {
    const hostile = {
      get value(): string {
        throw new Error('no');
      },
    };
    expect(describeValue(hostile)).toBe('{value: [Throws]}');
  });

  it('never throws into the host, even for a revoked proxy', () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(describeValue(proxy)).toBe('[Unserializable]');
  });

  it('renders the exotic primitives and collections readably', () => {
    expect(describeValue(10n)).toBe('10n');
    expect(describeValue(Symbol('tag'))).toBe('Symbol(tag)');
    expect(describeValue(() => 1)).toBe('[Function anonymous]');
    expect(describeValue(new Map([['k', 1]]))).toBe('Map {["k", 1]}');
    expect(describeValue(new Set([1, 2]))).toBe('Set {1, 2}');
    expect(describeValue(new Uint8Array(4))).toBe('[Uint8Array 4 bytes]');
  });
});
