import { readablePixels } from './qr-pixels';

const pixel = (red: number, green: number, blue: number, alpha: number) => [
  red,
  green,
  blue,
  alpha,
];

describe('a picture made readable for a QR reader', () => {
  it('lays a transparent background on white instead of reading it as black', () => {
    const source = {
      data: new Uint8ClampedArray([...pixel(0, 0, 0, 0), ...pixel(0, 0, 0, 255)]),
      width: 2,
      height: 1,
    };

    const readable = readablePixels(source);
    const at = (x: number, y: number) => {
      const index = (y * readable.width + x) * 4;
      return [...readable.data.slice(index, index + 4)];
    };
    const margin = (readable.width - 2 * Math.ceil(480 / 2)) / 2;

    expect(at(margin, margin)).toEqual([255, 255, 255, 255]);
    expect(at(readable.width - margin - 1, margin)).toEqual([0, 0, 0, 255]);
  });

  it('adds a white border and enlarges a small picture', () => {
    const readable = readablePixels({
      data: new Uint8ClampedArray(4 * 40 * 40),
      width: 40,
      height: 40,
    });

    expect(readable.width).toBeGreaterThanOrEqual(480);
    expect([...readable.data.slice(0, 4)]).toEqual([255, 255, 255, 255]);
  });
});
