/** RGBA pixels, four bytes each, row by row: what a canvas gives and the QR readers take. */
export interface IRgbaPixels {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly width: number;
  readonly height: number;
}

/** Smaller pictures are enlarged to about this side, so each module of the code spans a few pixels. */
const MIN_SIDE = 480;
/** The white border a reader needs around a code (four modules by the standard), as a share of the side. */
const QUIET_ZONE_SHARE = 0.1;
const CHANNELS = 4;
const OPAQUE = 255;

/**
 * A picture made easy to read: laid on white, so a code with a transparent
 * background is not read as black on black; given a white border, which a
 * screenshot cropped to the code lacks; and enlarged pixel by pixel when small.
 */
export function readablePixels(source: IRgbaPixels): IRgbaPixels {
  const scale = Math.max(1, Math.ceil(MIN_SIDE / Math.max(source.width, source.height)));
  const margin = Math.round(Math.max(source.width, source.height) * scale * QUIET_ZONE_SHARE);
  const width = source.width * scale + 2 * margin;
  const height = source.height * scale + 2 * margin;
  const data = new Uint8ClampedArray(width * height * CHANNELS).fill(OPAQUE);
  for (let y = 0; y < source.height * scale; y += 1) {
    for (let x = 0; x < source.width * scale; x += 1) {
      const from = (Math.floor(y / scale) * source.width + Math.floor(x / scale)) * CHANNELS;
      const to = ((y + margin) * width + x + margin) * CHANNELS;
      const alpha = (source.data[from + 3] ?? OPAQUE) / OPAQUE;
      for (let channel = 0; channel < 3; channel += 1) {
        data[to + channel] = (source.data[from + channel] ?? 0) * alpha + OPAQUE * (1 - alpha);
      }
    }
  }
  return { data, width, height };
}
