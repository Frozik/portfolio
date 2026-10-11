/**
 * The Shape Detection API's `BarcodeDetector` (Chromium on Android, macOS and
 * ChromeOS), as far as the vault's QR reader uses it; TypeScript's DOM lib
 * does not carry it yet.
 */
interface DetectedBarcode {
  readonly rawValue: string;
}

declare class BarcodeDetector {
  constructor(options?: { readonly formats: readonly string[] });
  detect(image: ImageBitmapSource): Promise<readonly DetectedBarcode[]>;
}
