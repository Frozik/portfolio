import type { TAction } from './action';
import type { IPlaceRule, TPlaceId } from './place-rule';
import type { IPolicy } from './policy';
import { narrowsNothing } from './policy';

/** A place added or changed; a group without a scheduled action gets one doing the opposite of «otherwise». */
export function withPlace(policy: IPolicy, place: IPlaceRule): IPolicy {
  const opposite: TAction = policy.otherwise === 'block' ? 'pass' : 'block';
  const scheduled = policy.scheduled ?? {
    action: opposite,
    schedule: null,
    calendars: [],
    places: [],
  };
  const others = scheduled.places.filter(existing => existing.id !== place.id);
  return { ...policy, scheduled: { ...scheduled, places: [...others, place] } };
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
  return { ...policy, scheduled: narrowsNothing(scheduled) ? null : scheduled };
}
