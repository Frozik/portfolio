import { assertNever } from '@frozik/utils/assert/assertNever';

import type { ExpressionNode } from './ast';
import type { Operator } from './tokenize';

export function evaluate(node: ExpressionNode, x: number): number {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'variable':
      return x;
    case 'negate':
      return -evaluate(node.operand, x);
    case 'binary':
      return applyOperator(node.operator, evaluate(node.left, x), evaluate(node.right, x));
    case 'call':
      return node.apply(evaluate(node.argument, x));
    default:
      return assertNever(node);
  }
}

function applyOperator(operator: Operator, left: number, right: number): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
    case '^':
      return left ** right;
    default:
      return assertNever(operator);
  }
}
