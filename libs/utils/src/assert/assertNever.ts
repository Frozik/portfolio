export function assertNever(value: never): never {
  throw new Error(`assertNever invocation for "${value}" type of ${typeof value}`);
}
