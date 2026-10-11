/** A stretch of the world axis taken out of view: `(from, to)`, both edges still there. */
export interface ICut<TX> {
  readonly from: TX;
  readonly to: TX;
}
