import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import type { ExpressionError } from './expression-error';
import { parseExpression } from './parse';

const LIMITS = { maxLength: 200, maxDepth: 32 } as const;

function valueOf(source: string, x: number): number {
  const parsed = parseExpression(source, LIMITS);
  if (!parsed.ok) {
    throw new Error(`${source}: ${parsed.error.reason} at ${parsed.error.position}`);
  }
  return evaluate(parsed.value, x);
}

function errorOf(source: string): ExpressionError | undefined {
  const parsed = parseExpression(source, LIMITS);
  return parsed.ok ? undefined : parsed.error;
}

describe('expression parser', () => {
  it('evaluates the example from the brief', () => {
    expect(valueOf('x^2 + 2x + 3', 2)).toBe(11);
  });

  it('applies the usual precedence and associativity', () => {
    expect(valueOf('1 + 2 * 3', 0)).toBe(7);
    expect(valueOf('(1 + 2) * 3', 0)).toBe(9);
    expect(valueOf('8 / 4 / 2', 0)).toBe(1);
    expect(valueOf('10 - 3 - 2', 0)).toBe(5);
    expect(valueOf('2 ^ 3 ^ 2', 0)).toBe(512);
    expect(valueOf('2 ** 3', 0)).toBe(8);
  });

  it('binds a leading minus looser than a power, as in mathematics', () => {
    expect(valueOf('-x^2', 3)).toBe(-9);
    expect(valueOf('2^-1', 0)).toBe(0.5);
    expect(valueOf('--x', 4)).toBe(4);
    expect(valueOf('+x', 4)).toBe(4);
  });

  it('multiplies juxtaposed terms', () => {
    expect(valueOf('2x', 5)).toBe(10);
    expect(valueOf('3(x + 1)', 1)).toBe(6);
    expect(valueOf('2sin(x)', Math.PI / 2)).toBe(2);
    expect(valueOf('x(x + 1)', 2)).toBe(6);
    expect(valueOf('2x^2', 3)).toBe(18);
    expect(valueOf('2pi', 0)).toBeCloseTo(2 * Math.PI);
  });

  it('reads 2e as two times e and 2e3 as a number', () => {
    expect(valueOf('2e', 0)).toBeCloseTo(2 * Math.E);
    expect(valueOf('2e3', 0)).toBe(2000);
    expect(valueOf('1.5e-1', 0)).toBe(0.15);
    expect(valueOf('.5', 0)).toBe(0.5);
  });

  it('splits letters run together into the names it knows', () => {
    expect(valueOf('xsin(x)', Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(valueOf('2pix', 1)).toBeCloseTo(2 * Math.PI);
    expect(valueOf('sinh(0) + exp(0)', 0)).toBe(1);
    expect(valueOf('ex', 2)).toBeCloseTo(2 * Math.E);
    expect(errorOf('x + 2xfoo')).toEqual({ position: 6, reason: 'unknown-identifier' });
  });

  it('knows its functions and constants, case-insensitively', () => {
    expect(valueOf('sqrt(abs(x))', -16)).toBe(4);
    expect(valueOf('ln(e)', 0)).toBe(1);
    expect(valueOf('log(1000)', 0)).toBe(3);
    expect(valueOf('SIN(PI / 2)', 0)).toBe(1);
  });

  it('points at the offending character', () => {
    expect(errorOf('x + $')).toEqual({ position: 4, reason: 'unexpected-character' });
    expect(errorOf('x + y')).toEqual({ position: 4, reason: 'unknown-identifier' });
    expect(errorOf('x + * 2')).toEqual({ position: 4, reason: 'unexpected-token' });
    expect(errorOf('(x + 1')).toEqual({ position: 6, reason: 'unexpected-end' });
    expect(errorOf('x + 1)')).toEqual({ position: 5, reason: 'unexpected-token' });
    expect(errorOf('sin x')).toEqual({ position: 4, reason: 'unexpected-token' });
    expect(errorOf('x 2')).toEqual({ position: 2, reason: 'unexpected-token' });
  });

  it('refuses empty, overlong and overly nested input', () => {
    expect(errorOf('   ')).toEqual({ position: 0, reason: 'empty' });
    expect(errorOf('x'.repeat(LIMITS.maxLength + 1))?.reason).toBe('too-long');
    expect(errorOf(`${'('.repeat(40)}x${')'.repeat(40)}`)?.reason).toBe('too-deep');
  });

  it('gives no identifier access to anything inherited by objects', () => {
    for (const name of ['constructor', 'prototype', 'toString', 'valueOf']) {
      expect(errorOf(`${name}(x)`)?.reason).toBe('unknown-identifier');
    }
    expect(errorOf('__proto__')?.reason).toBe('unexpected-character');
  });
});
