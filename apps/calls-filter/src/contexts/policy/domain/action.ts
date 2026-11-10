/** What a rule does with a call: rejects it or lets it ring. A repeat ringing is a switch over it. */
export type TAction = 'block' | 'pass';

export function oppositeOf(action: TAction): TAction {
  return action === 'block' ? 'pass' : 'block';
}

/** Fail-open: a call two groups claim at once rings if either lets it. */
export function mostLenient(actions: readonly TAction[]): TAction {
  return actions.includes('pass') ? 'pass' : 'block';
}
