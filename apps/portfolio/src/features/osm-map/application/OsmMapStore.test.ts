import { DEFAULT_VIEW, viewAround } from '../domain/map-view';
import type { LonLat } from '../domain/mercator';
import { OsmMapStore } from './OsmMapStore';
import type { HomeStorage } from './ports/home-storage';
import type { PositionFailure, PositionSource } from './ports/position-source';

const PARIS: LonLat = { lat: 48.8566, lon: 2.3522 };

function createStore(options: { readonly remembered?: LonLat } = {}) {
  let remembered = options.remembered;
  const homeStorage: HomeStorage = {
    read: () => remembered,
    write: position => {
      remembered = position;
    },
  };
  const requests: Array<{
    onPosition: (position: LonLat) => void;
    onFailure: (reason: PositionFailure) => void;
  }> = [];
  const cancel = vi.fn();
  const requestPosition: PositionSource = (onPosition, onFailure) => {
    requests.push({ onPosition, onFailure });
    return cancel;
  };
  const store = new OsmMapStore(requestPosition, homeStorage);
  return { store, requests, cancel, remembered: () => remembered };
}

describe('OsmMapStore', () => {
  it('shows the compass the bearing the renderer reports', () => {
    const { store } = createStore();

    store.reportBearing(35);

    expect(store.bearingDeg).toBe(35);
  });

  it('sends north-up to the attached renderer and to nobody after detaching', () => {
    const { store } = createStore();
    const resetNorth = vi.fn();

    const detach = store.attachViewControl({ resetNorth, moveTo: vi.fn() });
    store.resetNorth();
    detach();
    store.resetNorth();

    expect(resetNorth).toHaveBeenCalledTimes(1);
  });

  it('opens over the remembered place, and over the default one when none is remembered', () => {
    expect(createStore({ remembered: PARIS }).store.home).toEqual(viewAround(PARIS));
    expect(createStore().store.home).toEqual(DEFAULT_VIEW);
  });

  it('centres the map on the user when located, and remembers the place', () => {
    const { store, requests, remembered } = createStore();
    const moveTo = vi.fn();
    store.attachViewControl({ resetNorth: vi.fn(), moveTo });

    store.locate();
    expect(store.locating).toBe(true);
    requests[0].onPosition(PARIS);

    expect(store.locating).toBe(false);
    expect(moveTo).toHaveBeenCalledWith(PARIS);
    expect(remembered()).toEqual(PARIS);
    expect(store.home).toEqual(viewAround(PARIS));
  });

  it('stops waiting when locating fails and withdraws a request on dispose', () => {
    const { store, requests, cancel } = createStore();

    store.locate();
    requests[0].onFailure('denied');
    expect(store.locating).toBe(false);
    expect(store.locateFailure).toBe('denied');

    store.locate();
    expect(store.locateFailure).toBeUndefined();
    store.dispose();
    expect(cancel).toHaveBeenCalled();
  });
});
