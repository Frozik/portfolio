export const timeseriesTranslationsEn = {
  pageMenu: 'Pages of the demo',
  pages: {
    overview: 'Overview',
    marks: 'Marks',
    live: 'Live',
    snapshot: 'Snapshot',
    sync: 'Synced',
  },
  captions: {
    overview:
      'Four charts on one GPU device: a line under the candles of another series, candles, a line whose thickness follows the value, markers coloured by threshold.',
    marks:
      'Every way to draw: area and stairs with a gap in the data, a line and rings drawn from candles, every marker figure with fill and stroke in different colours and sizes, a line with an outline.',
    live: 'A series that ends at this very moment: new elements arrive by subscription, the candle of the current interval keeps growing.',
    snapshot:
      'An ordinary chart over a numeric axis: the whole set of points is replaced a few times a second.',
    sync: 'Two charts sharing one viewport; the position under the pointer on one is marked on the other.',
  },
  debugOverlay: {
    debug: 'Debug',
    loadingDelay: 'Loading delay',
    sourceFailures: 'Source failures',
    canvasOnly: 'Canvas 2D only',
    renderers: {
      webgpu: 'WebGPU',
      canvas2d: 'Canvas 2D',
    },
  },
  live: {
    following: 'Following the live edge',
    history: 'Looking at history',
    toLiveEdge: 'To the live edge',
    styles: {
      line: 'Line',
      stairs: 'Stairs',
      area: 'Area',
    },
  },
} as const;
