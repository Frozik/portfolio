import type { IPlaceRule, TPlaceId } from './place-rule';
import type { IPolicy } from './policy';
import { withConditions } from './policy';

/** A place added or changed; the group's first condition starts its scheduled action. */
export function withPlace(policy: IPolicy, place: IPlaceRule): IPolicy {
  const scheduled = policy.scheduled ?? {
    schedule: null,
    calendars: [],
    places: [],
  };
  const others = scheduled.places.filter(existing => existing.id !== place.id);
  return withConditions(policy, { ...scheduled, places: [...others, place] });
}

/** A place taken out; a scheduled action left narrowing nothing goes with it. */
export function withoutPlace(policy: IPolicy, id: TPlaceId): IPolicy {
  if (policy.scheduled === null) {
    return policy;
  }
  const scheduled = {
    ...policy.scheduled,
    places: policy.scheduled.places.filter(place => place.id !== id),
  };
  return withConditions(policy, scheduled);
}
