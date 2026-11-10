import type { IPlaceRule, TPlaceId } from './place-rule';
import type { IPolicy } from './policy';
import { withConditions } from './policy';

/** A place added or changed: the group's first place may be its first condition. */
export function withPlace(policy: IPolicy, place: IPlaceRule): IPolicy {
  const conditions = policy.conditions ?? {
    schedule: null,
    calendars: [],
    places: [],
  };
  const others = conditions.places.filter(existing => existing.id !== place.id);
  return withConditions(policy, { ...conditions, places: [...others, place] });
}

/** A place taken out; conditions left narrowing nothing go with it. */
export function withoutPlace(policy: IPolicy, id: TPlaceId): IPolicy {
  if (policy.conditions === null) {
    return policy;
  }
  const conditions = {
    ...policy.conditions,
    places: policy.conditions.places.filter(place => place.id !== id),
  };
  return withConditions(policy, conditions);
}
