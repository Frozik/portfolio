import type { TAction } from './action';
import type { IPolicy } from './policy';

/** A group starts its schedule, calendars and places doing the other thing from what it usually does. */
export function windowActionOf(policy: IPolicy): TAction {
  return policy.scheduled?.action ?? (policy.otherwise === 'block' ? 'pass' : 'block');
}

/** What the group does while its schedule, calendars and places hold; nothing to set without them. */
export function withWindowAction(policy: IPolicy, action: TAction): IPolicy {
  return policy.scheduled === null
    ? policy
    : { ...policy, scheduled: { ...policy.scheduled, action } };
}
