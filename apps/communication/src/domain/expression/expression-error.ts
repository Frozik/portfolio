export type ExpressionErrorReason =
  | 'empty'
  | 'too-long'
  | 'too-deep'
  | 'unexpected-character'
  | 'invalid-number'
  | 'unknown-identifier'
  | 'unexpected-token'
  | 'unexpected-end';

/** Where parsing stopped (a character offset into the source) and why. */
export interface ExpressionError {
  readonly position: number;
  readonly reason: ExpressionErrorReason;
}

export interface ExpressionLimits {
  readonly maxLength: number;
  readonly maxDepth: number;
}
