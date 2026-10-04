import { describe, expect, it } from 'vitest';

import { pickRecordingFormat } from './recording-format';

describe('pickRecordingFormat', () => {
  it('takes the best WebM codec the browser offers', () => {
    const format = pickRecordingFormat(
      mime => mime === 'video/webm;codecs=vp8' || mime === 'video/webm'
    );
    expect(format).toEqual({ mimeType: 'video/webm;codecs=vp8', extension: 'webm' });
  });

  it('falls back to MP4 on a browser without WebM recording', () => {
    expect(pickRecordingFormat(mime => mime === 'video/mp4')?.extension).toBe('mp4');
  });

  it('reports no format when nothing is recordable', () => {
    expect(pickRecordingFormat(() => false)).toBeNull();
  });
});
