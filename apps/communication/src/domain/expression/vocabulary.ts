export const VARIABLE = 'x';

/** A Map, not an object: no identifier can reach `constructor`, `__proto__` or anything else inherited. */
export const CONSTANTS: ReadonlyMap<string, number> = new Map([
  ['pi', Math.PI],
  ['e', Math.E],
]);

export const FUNCTIONS: ReadonlyMap<string, (argument: number) => number> = new Map([
  ['sin', Math.sin],
  ['cos', Math.cos],
  ['tan', Math.tan],
  ['asin', Math.asin],
  ['acos', Math.acos],
  ['atan', Math.atan],
  ['sinh', Math.sinh],
  ['cosh', Math.cosh],
  ['tanh', Math.tanh],
  ['sqrt', Math.sqrt],
  ['abs', Math.abs],
  ['exp', Math.exp],
  ['ln', Math.log],
  ['log', Math.log10],
  ['floor', Math.floor],
  ['ceil', Math.ceil],
  ['sign', Math.sign],
]);
