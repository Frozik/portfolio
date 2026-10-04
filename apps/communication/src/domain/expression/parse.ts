import type { Result } from '../Result';
import { err, ok } from '../Result';
import type { ExpressionNode } from './ast';
import type { ExpressionError, ExpressionLimits } from './expression-error';
import type { Operator, Token } from './tokenize';
import { tokenize } from './tokenize';
import { CONSTANTS, FUNCTIONS, VARIABLE } from './vocabulary';

type Parsed = Result<ExpressionNode, ExpressionError>;

/** Left and right binding powers; `^` binds right-to-left and tighter than a leading minus. */
const INFIX: ReadonlyMap<Operator, readonly [number, number]> = new Map([
  ['+', [10, 11]],
  ['-', [10, 11]],
  ['*', [20, 21]],
  ['/', [20, 21]],
  ['^', [31, 30]],
]);
const IMPLICIT_PRODUCT = INFIX.get('*') ?? [0, 0];
const NEGATION_BINDING = 25;

/**
 * Parses a function of `x` without ever evaluating source text: the result is
 * a tree of whitelisted operations. `2x`, `3(x + 1)` and `2sin(x)` multiply.
 */
export function parseExpression(source: string, limits: ExpressionLimits): Parsed {
  if (source.length > limits.maxLength) {
    return err({ position: limits.maxLength, reason: 'too-long' });
  }
  if (source.trim().length === 0) {
    return err({ position: 0, reason: 'empty' });
  }
  const tokens = tokenize(source);
  if (!tokens.ok) {
    return tokens;
  }
  return new Parser(tokens.value, limits.maxDepth).parse();
}

class Parser {
  private index = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly maxDepth: number
  ) {}

  parse(): Parsed {
    const tree = this.expression(0, 0);
    if (!tree.ok) {
      return tree;
    }
    const rest = this.peek();
    return rest.kind === 'end'
      ? tree
      : err({ position: rest.position, reason: 'unexpected-token' });
  }

  private expression(minBinding: number, depth: number): Parsed {
    if (depth > this.maxDepth) {
      return err({ position: this.peek().position, reason: 'too-deep' });
    }
    let left = this.prefix(depth);
    for (;;) {
      if (!left.ok) {
        return left;
      }
      const next = this.peek();
      const explicit = next.kind === 'operator' ? INFIX.get(next.operator) : undefined;
      const implicit = next.kind === 'identifier' || next.kind === 'open';
      const [leftBinding, rightBinding] = explicit ?? (implicit ? IMPLICIT_PRODUCT : [-1, -1]);
      if (leftBinding < minBinding) {
        return left;
      }
      const operator: Operator = next.kind === 'operator' ? next.operator : '*';
      if (explicit !== undefined) {
        this.index += 1;
      }
      const right = this.expression(rightBinding, depth + 1);
      left = right.ok
        ? ok({ kind: 'binary', operator, left: left.value, right: right.value })
        : right;
    }
  }

  private prefix(depth: number): Parsed {
    const token = this.advance();
    switch (token.kind) {
      case 'number':
        return ok({ kind: 'number', value: token.value });
      case 'identifier':
        return this.identifier(token.name, token.position, depth);
      case 'open':
        return this.parenthesised(depth);
      case 'operator':
        if (token.operator === '-') {
          const operand = this.expression(NEGATION_BINDING, depth + 1);
          return operand.ok ? ok({ kind: 'negate', operand: operand.value }) : operand;
        }
        if (token.operator === '+') {
          return this.expression(NEGATION_BINDING, depth + 1);
        }
        return err({ position: token.position, reason: 'unexpected-token' });
      case 'close':
        return err({ position: token.position, reason: 'unexpected-token' });
      case 'end':
        return err({ position: token.position, reason: 'unexpected-end' });
    }
  }

  private identifier(name: string, position: number, depth: number): Parsed {
    if (name === VARIABLE) {
      return ok({ kind: 'variable' });
    }
    const constant = CONSTANTS.get(name);
    if (constant !== undefined) {
      return ok({ kind: 'number', value: constant });
    }
    const apply = FUNCTIONS.get(name);
    if (apply === undefined) {
      return err({ position, reason: 'unknown-identifier' });
    }
    const open = this.advance();
    if (open.kind !== 'open') {
      return err({
        position: open.position,
        reason: open.kind === 'end' ? 'unexpected-end' : 'unexpected-token',
      });
    }
    const argument = this.parenthesised(depth);
    return argument.ok ? ok({ kind: 'call', apply, argument: argument.value }) : argument;
  }

  /** Called after `(` has been consumed. */
  private parenthesised(depth: number): Parsed {
    const inner = this.expression(0, depth + 1);
    if (!inner.ok) {
      return inner;
    }
    const close = this.advance();
    if (close.kind !== 'close') {
      return err({
        position: close.position,
        reason: close.kind === 'end' ? 'unexpected-end' : 'unexpected-token',
      });
    }
    return inner;
  }

  private peek(): Token {
    return this.tokens[this.index] ?? this.endToken();
  }

  private advance(): Token {
    const token = this.peek();
    if (token.kind !== 'end') {
      this.index += 1;
    }
    return token;
  }

  private endToken(): Token {
    return this.tokens.at(-1) ?? { kind: 'end', position: 0 };
  }
}
