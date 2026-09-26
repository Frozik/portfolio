import { createHomeStorage } from './home-storage';

function fakeStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: key => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
}

describe('home storage', () => {
  it('round-trips a position', () => {
    const storage = createHomeStorage(fakeStorage());

    storage.write({ lat: 48.8566, lon: 2.3522 });

    expect(storage.read()).toEqual({ lat: 48.8566, lon: 2.3522 });
  });

  it('answers nothing on a first visit or a corrupt entry', () => {
    expect(createHomeStorage(fakeStorage()).read()).toBeUndefined();
    expect(
      createHomeStorage(fakeStorage({ 'osm-map:home': '{"lat":95,"lon":0}' })).read()
    ).toBeUndefined();
    expect(createHomeStorage(fakeStorage({ 'osm-map:home': 'garbage' })).read()).toBeUndefined();
  });
});
