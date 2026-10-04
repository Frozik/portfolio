import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import fixWebmDuration from 'fix-webm-duration';
import { isNil } from 'lodash-es';

import type { IRecordingHandle, IRecordingResult } from '../core/ports';
import { CaptureError } from '../core/ports';
import type { IRecordingFormat } from '../core/recording-format';

export interface IRecorderOptions {
  readonly format: IRecordingFormat;
  readonly maxDurationMs: number;
  readonly videoBitsPerSecond: number;
}

/** Every chunk continues the previous one (the container header is in the first), so a short slice costs nothing. */
const TIMESLICE_MS = 1_000;
/** Patching the WebM duration reads the whole file; past this size the seek bar is not worth the memory. */
const MAX_DURATION_FIX_BYTES = 200 * 1_024 * 1_024;

/**
 * Records the display stream until `stop()`, the duration limit or the
 * browser's own "stop sharing" control, then hands back one playable file.
 */
export function recordStream(stream: MediaStream, options: IRecorderOptions): IRecordingHandle {
  const recorder = new MediaRecorder(stream, {
    mimeType: options.format.mimeType,
    videoBitsPerSecond: options.videoBitsPerSecond,
  });
  const chunks: Blob[] = [];
  const startedAt = performance.now();
  const bag = new DisposableBag();
  const [track] = stream.getVideoTracks();

  const finished = new Promise<IRecordingResult>((resolve, reject) => {
    recorder.addEventListener('dataavailable', event => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });
    recorder.addEventListener('error', event => {
      bag.disposeAll();
      reject(new CaptureError('failed', 'error' in event ? event.error : undefined));
    });
    recorder.addEventListener('stop', () => {
      bag.disposeAll();
      const durationMs = Math.round(performance.now() - startedAt);
      void finalize(chunks, options.format, durationMs).then(
        video => resolve({ video, format: options.format, durationMs }),
        reason => reject(new CaptureError('failed', reason))
      );
    });
  });

  const stop = () => {
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };
  const limit = setTimeout(stop, options.maxDurationMs);
  bag.add(() => clearTimeout(limit));
  if (!isNil(track)) {
    track.addEventListener('ended', stop);
    bag.add(() => track.removeEventListener('ended', stop));
  }
  recorder.start(TIMESLICE_MS);
  return { stop, finished };
}

async function finalize(
  chunks: readonly Blob[],
  format: IRecordingFormat,
  durationMs: number
): Promise<Blob> {
  const video = new Blob([...chunks], { type: format.mimeType });
  if (format.extension !== 'webm' || video.size > MAX_DURATION_FIX_BYTES) {
    return video;
  }
  return fixWebmDuration(video, durationMs, { logger: false });
}
