import { DEFAULT_VIEW, viewAround } from '../domain/map-view';
import type { LonLat } from '../domain/mercator';
import type { MapStats } from './OsmMapStore';
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

const STATS: MapStats = {
  zoom: 12,
  bearingDeg: 0,
  pitchDeg: 40,
  visibleTiles: 30,
  loadingTiles: 2,
  atlasUsed: 10,
  atlasCapacity: 64,
  cachedTiles: 40,
};

describe('OsmMapStore', () => {
  it('keeps the same stats object while the numbers do not move', () => {
    const { store } = createStore();

    store.reportFrame(STATS);
    const first = store.stats;
    store.reportFrame({ ...STATS });

    expect(store.stats).toBe(first);
    store.reportFrame({ ...STATS, loadingTiles: 0 });
    expect(store.stats.loadingTiles).toBe(0);
  });

  it('sends the reset to the attached renderer and to nobody after detaching', () => {
    const { store } = createStore();
    const setView = vi.fn();
    const resetNorth = vi.fn();

    const detach = store.attachViewControl({ setView, resetNorth, moveTo: vi.fn() });
    store.resetView();
    store.resetNorth();
    detach();
    store.resetView();
    store.resetNorth();

    expect(setView).toHaveBeenCalledTimes(1);
    expect(setView).toHaveBeenCalledWith(DEFAULT_VIEW);
    expect(resetNorth).toHaveBeenCalledTimes(1);
  });

  it('opens over the remembered place and resets there', () => {
    const { store } = createStore({ remembered: PARIS });
    const setView = vi.fn();

    store.attachViewControl({ setView, resetNorth: vi.fn(), moveTo: vi.fn() });
    store.resetView();

    expect(store.home).toEqual(viewAround(PARIS));
    expect(setView).toHaveBeenCalledWith(viewAround(PARIS));
  });

  it('centres the map on the user when located, and remembers the place', () => {
    const { store, requests, remembered } = createStore();
    const moveTo = vi.fn();
    store.attachViewControl({ setView: vi.fn(), resetNorth: vi.fn(), moveTo });

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
