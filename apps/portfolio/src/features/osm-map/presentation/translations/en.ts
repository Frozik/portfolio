export const osmMapTranslationsEn = {
  hud: {
    loading: 'Loading the map…',
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
  help: {
    open: 'How to use the map',
    close: 'Close',
    title: 'How to use the map',
    sections: [
      {
        title: 'Mouse',
        items: [
          ['Drag', 'pan'],
          ['Wheel', 'zoom around the cursor'],
          ['Right button or Ctrl + drag', 'turn and tilt'],
        ],
      },
      {
        title: 'Touch',
        items: [
          ['One finger', 'pan'],
          ['Pinch', 'zoom'],
          ['Two fingers dragging', 'tilt'],
          ['Two fingers twisting', 'turn'],
        ],
      },
      {
        title: 'On the map',
        items: [
          ['Compass', 'turns with the map; press it to put north up'],
          ['Crosshair button', 'centres the map on you'],
          ['Buildings', 'rise from zoom 16'],
          ['Cars', 'drive the streets from zoom 17'],
          ['Link', 'the address bar follows the view; share it to share the view'],
        ],
      },
    ],
  },
  attribution: '© OpenStreetMap contributors · OpenFreeMap · © OpenMapTiles',
};
