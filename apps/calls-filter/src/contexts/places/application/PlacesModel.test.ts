import { observable, runInAction } from 'mobx';

import type { IPlaceRule, IPoint, TPlaceId } from '../../policy/domain/place-rule';
import { distanceMeters } from '../../policy/domain/place-rule';
import type { IGeofences } from '../domain/ports/geofences';
import { PlacesModel } from './PlacesModel';

const AMSTERDAM: IPoint = { latitude: 52.3676, longitude: 4.9041 };
const NEW_YORK: IPoint = { latitude: 40.7484, longitude: -73.9857 };

const office: IPlaceRule = {
  id: 'office' as TPlaceId,
  name: 'Office',
  ...AMSTERDAM,
  radius: 500,
  mode: 'only-at',
};

/** Android's geofences as the phone sees them: crossings arrive only when the test says so. */
class FakeGeofences implements IGeofences {
  phoneAt: IPoint = AMSTERDAM;
  failing = false;
  readonly verdicts = new Map<TPlaceId, boolean | null>();
  watched: readonly IPlaceRule[] = [];
  registrations = 0;

  async watch(places: readonly IPlaceRule[]) {
    this.watched = places;
    this.registrations += 1;
    await this.settle(places);
  }

  async settle(places: readonly IPlaceRule[]) {
    if (this.failing) {
      throw new Error('no position');
    }
    for (const place of places) {
      this.verdicts.set(place.id, distanceMeters(this.phoneAt, place) <= place.radius);
    }
  }

  atPlace(place: TPlaceId) {
    return this.verdicts.get(place) ?? null;
  }
}

function setup(places: readonly IPlaceRule[]) {
  const geofences = new FakeGeofences();
  const rules = observable.box(places, { deep: false });
  const errors: string[] = [];
  const backgroundAllowed = observable.box(true);
  const model = new PlacesModel(
    {
      geofences,
      searchAddress: async () => [],
      currentPoint: async () => null,
      diagnostics: { log: (_level, _category, event) => errors.push(event), latest: () => [] },
    },
    () => rules.get(),
    () => backgroundAllowed.get()
  );
  return { model, geofences, rules, errors, backgroundAllowed };
}

const settled = () => new Promise(resolve => setTimeout(resolve, 0));

describe('PlacesModel', () => {
  it('says the phone is at a place right after the place is watched', async () => {
    const { model, geofences } = setup([office]);
    const stop = model.follow();
    await settled();
    expect(geofences.watched).toEqual([office]);
    expect(model.atPlace(office.id)).toBe(true);
    stop();
  });

  it('measures again on settling, so a late geofence never leaves the phone at a place it left', async () => {
    const { model, geofences } = setup([office]);
    const stop = model.follow();
    await settled();
    geofences.phoneAt = NEW_YORK;
    await model.settle();
    expect(model.atPlace(office.id)).toBe(false);
    stop();
  });

  it('keeps the last verdict and records the failure when the position cannot be measured', async () => {
    const { model, geofences, errors } = setup([office]);
    const stop = model.follow();
    await settled();
    geofences.failing = true;
    geofences.phoneAt = NEW_YORK;
    await model.settle();
    expect(model.atPlace(office.id)).toBe(true);
    expect(errors).toContain('places-settle-failed');
    stop();
  });

  it('knows nothing of a place before its geofence says anything', () => {
    const { model } = setup([office]);
    expect(model.atPlace(office.id)).toBeNull();
  });

  it('lands a measurement asked for during a slow geofence registration after it, not under it', async () => {
    const { model, geofences } = setup([office]);
    let finishWatch = () => {};
    geofences.watch = places =>
      new Promise<void>(resolve => {
        finishWatch = () => {
          geofences.watched = places;
          for (const place of places) {
            geofences.verdicts.set(place.id, true);
          }
          resolve();
        };
      });
    const stop = model.follow();
    await settled();
    geofences.phoneAt = NEW_YORK;
    const measured = model.settle();
    finishWatch();
    await measured;
    expect(model.atPlace(office.id)).toBe(false);
    stop();
  });

  it('watches a moved place again under its new fence', async () => {
    const { model, geofences, rules } = setup([office]);
    const stop = model.follow();
    await settled();
    const moved = { ...office, ...NEW_YORK };
    runInAction(() => rules.set([moved]));
    await settled();
    expect(geofences.watched).toEqual([moved]);
    expect(model.atPlace(office.id)).toBe(false);
    stop();
  });

  it('registers the geofences again once the phone allows location all the time', async () => {
    const { model, geofences, backgroundAllowed } = setup([office]);
    runInAction(() => backgroundAllowed.set(false));
    const stop = model.follow();
    await settled();
    runInAction(() => backgroundAllowed.set(true));
    await settled();
    expect(geofences.registrations).toBe(2);
    stop();
  });
});
