import { describe, expect, it } from 'vitest';

import { hexToRgb, resolveStyle } from './styles-processor';
import type { PartialElementStyle } from './types';

describe('hexToRgb', () => {
  it('converts white', () => {
    expect(hexToRgb('#FFFFFF')).toEqual([1, 1, 1]);
  });

  it('converts black', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
  });

  it('converts arbitrary color', () => {
    const [red, green, blue] = hexToRgb('#FF9900');
    expect(red).toBe(1);
    expect(green).toBeCloseTo(0.6, 2);
    expect(blue).toBe(0);
  });

  it('converts highlight color accurately', () => {
    const [red, green, blue] = hexToRgb('#66BFFF');
    expect(red).toBeCloseTo(0.4, 2);
    expect(green).toBeCloseTo(0.749, 2);
    expect(blue).toBe(1);
  });

  it('throws on invalid format', () => {
    expect(() => hexToRgb('FFFFFF')).toThrow();
    expect(() => hexToRgb('#FFF')).toThrow();
    expect(() => hexToRgb('')).toThrow();
  });
});

describe('resolveStyle', () => {
  const testStyles: Readonly<Record<string, PartialElementStyle>> = {
    segment: {
      color: '#FFFFFF',
      width: 5.0,
      line: { type: 'solid' },
    },
    'segment:hidden': {
      alpha: 0.3,
      line: { type: 'dashed', dash: 10, gap: 10 },
    },
    'segment:selected': {
      width: 7.0,
      color: '#66BFFF',
    },
    'segment:hidden:selected': {
      width: 9.0,
    },
  };

  it('resolves base element with defaults', () => {
    const resolved = resolveStyle(testStyles, 'segment', []);
    expect(resolved.color).toBe('#FFFFFF');
    expect(resolved.width).toBe(5.0);
    expect(resolved.line).toEqual({ type: 'solid' });
    expect(resolved.alpha).toBe(1.0);
    expect(resolved.size).toBe(1.0);
  });

  it('resolves single modifier', () => {
    const resolved = resolveStyle(testStyles, 'segment', ['hidden']);
    expect(resolved.width).toBe(5.0);
    expect(resolved.alpha).toBe(0.3);
    expect(resolved.line).toEqual({ type: 'dashed', dash: 10, gap: 10 });
  });

  it('resolves multi-modifier cascade', () => {
    const resolved = resolveStyle(testStyles, 'segment', ['hidden', 'selected']);
    // Base: width=5, color=#FFFFFF, line=solid
    // + hidden: alpha=0.3, line=dashed
    // + selected: width=7, color=#66BFFF
    // + hidden:selected: width=9 (most specific wins)
    expect(resolved.width).toBe(9.0);
    expect(resolved.color).toBe('#66BFFF');
    expect(resolved.alpha).toBe(0.3);
    expect(resolved.line).toEqual({ type: 'dashed', dash: 10, gap: 10 });
  });

  it('modifier order does not affect result', () => {
    const resultA = resolveStyle(testStyles, 'segment', ['hidden', 'selected']);
    const resultB = resolveStyle(testStyles, 'segment', ['selected', 'hidden']);
    expect(resultA).toEqual(resultB);
  });

  it('unknown modifiers pass through without error', () => {
    const resolved = resolveStyle(testStyles, 'segment', ['unknown']);
    // Only base 'segment' applies, 'segment:unknown' does not exist
    expect(resolved.width).toBe(5.0);
    expect(resolved.color).toBe('#FFFFFF');
  });

  it('unknown element returns defaults', () => {
    const resolved = resolveStyle(testStyles, 'nonexistent', []);
    expect(resolved.color).toBe('#FFFFFF');
    expect(resolved.width).toBe(1.0);
    expect(resolved.alpha).toBe(1.0);
  });

  it('line property uses shallow replace, not deep merge', () => {
    const styles: Readonly<Record<string, PartialElementStyle>> = {
      test: { line: { type: 'dashed', dash: 5, gap: 5 } },
      'test:mod': { line: { type: 'solid' } },
    };
    const resolved = resolveStyle(styles, 'test', ['mod']);
    expect(resolved.line).toEqual({ type: 'solid' });
  });

  it('normalizes style keys with unordered modifiers', () => {
    const styles: Readonly<Record<string, PartialElementStyle>> = {
      test: { width: 1 },
      'test:beta:alpha': { width: 5 },
    };
    const resolved = resolveStyle(styles, 'test', ['alpha', 'beta']);
    expect(resolved.width).toBe(5);
  });

  it('matches keys regardless of modifier order in style map', () => {
    const styles: Readonly<Record<string, PartialElementStyle>> = {
      test: { width: 1, alpha: 1 },
      'test:selected:hidden': { alpha: 0.8 },
    };
    const resolved = resolveStyle(styles, 'test', ['hidden', 'selected']);
    expect(resolved.alpha).toBe(0.8);
  });
});
