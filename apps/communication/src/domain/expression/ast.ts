import type { Operator } from './tokenize';

export type ExpressionNode =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'variable' }
  | { readonly kind: 'negate'; readonly operand: ExpressionNode }
  | {
      readonly kind: 'binary';
      readonly operator: Operator;
      readonly left: ExpressionNode;
      readonly right: ExpressionNode;
    }
  | {
      readonly kind: 'call';
      readonly apply: (argument: number) => number;
      readonly argument: ExpressionNode;
    };
