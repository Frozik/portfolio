export const sunTranslationsEn = {
  panel: {
    title: 'GPU test',
    restart: 'Run the test again',
    copy: 'Copy the full report',
    copied: 'Report copied',
    copyFailed: 'The browser refused to copy',
    status: {
      calibrating: 'Reading the display rate…',
      searching: 'Adding triangles until frames drop…',
      finished: 'Done: the most triangles with no dropped frames',
    },
    fps: 'FPS',
    display: 'Display',
    hertz: (rate: number): string => `${rate} Hz`,
    trying: 'Trying',
    holds: 'Holds',
    canvas: 'Canvas',
    card: 'Graphics card',
    acceleration: 'Acceleration',
    accelerationKind: {
      hardware: 'hardware',
      software: 'software, no GPU',
      unknown: 'unknown',
    },
    limits: 'Limits',
    features: (supported: number, total: number): string => `Features ${supported}/${total}`,
    gpuPending: 'Starting WebGPU…',
    failure: {
      'no-api': 'This browser has no WebGPU',
      'insecure-context': 'WebGPU needs a secure page (HTTPS)',
      'no-adapter':
        'The browser gave no WebGPU adapter: the card is blocklisted or hardware acceleration is off',
      'no-device': 'The adapter refused to create a device',
      'device-lost': 'The GPU device was lost',
    },
  },
};
