export interface IRecordingFormat {
  readonly mimeType: string;
  readonly extension: 'webm' | 'mp4';
}

/** Best quality first; every browser that records at all supports at least one of these. */
const CANDIDATES: readonly IRecordingFormat[] = [
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
  { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
];

export function pickRecordingFormat(
  isTypeSupported: (mimeType: string) => boolean
): IRecordingFormat | null {
  return CANDIDATES.find(candidate => isTypeSupported(candidate.mimeType)) ?? null;
}
