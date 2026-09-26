export const osmMapTranslationsEn = {
  hud: {
    zoom: (zoom: number): string => `z ${zoom.toFixed(2)}`,
    pitch: (degrees: number): string => `pitch ${degrees.toFixed(0)}°`,
    bearing: (degrees: number): string => `bearing ${degrees.toFixed(0)}°`,
    tiles: (visible: number, loading: number): string =>
      loading > 0 ? `${visible} tiles, ${loading} loading` : `${visible} tiles`,
    atlas: (used: number, capacity: number): string => `atlas ${used}/${capacity}`,
    cached: (count: number): string => `stored ${count}`,
    buildings: (tiles: number, loading: number): string =>
      loading > 0 ? `buildings ${tiles} tiles, ${loading} loading` : `buildings ${tiles} tiles`,
    cars: (count: number): string => `cars ${count}`,
    reset: 'Reset view',
    locate: 'Show where I am',
    locating: 'Finding where you are…',
    locateFailure: {
      denied:
        'Location access was denied — allow it for this site in the browser, and for the browser in the system.',
      unavailable: 'The browser could not determine a position: the system gave it none.',
      timeout: 'No position arrived in time — try again.',
      unsupported: 'This browser has no geolocation.',
    },
    compass: (bearingDeg: number): string =>
      `North is ${Math.round(bearingDeg)}° off — press to point it up`,
  },
  help: 'Drag to pan, wheel or pinch to zoom, right button or Ctrl+drag to turn and tilt; two fingers tilt by dragging and turn by twisting.',
  attribution: '© OpenStreetMap contributors · OpenFreeMap · © OpenMapTiles',
};
