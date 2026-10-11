/** The text of a QR code in a picture (a screenshot, a photo); `null` when it holds none. */
export type TReadQrCode = (image: {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly mime: string;
}) => Promise<string | null>;
