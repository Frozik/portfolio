import { Font } from '@react-pdf/renderer';

import interBoldUrl from '../../../../assets/fonts/Inter-Bold.ttf?url';
import interRegularUrl from '../../../../assets/fonts/Inter-Regular.ttf?url';

export const PDF_FONT_FAMILY = 'Inter';

let registered = false;

export function ensurePdfFontsRegistered(): void {
  if (registered) {
    return;
  }
  registered = true;

  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: interRegularUrl, fontWeight: 400 },
      { src: interBoldUrl, fontWeight: 700 },
    ],
  });

  Font.registerHyphenationCallback(word => [word]);
}
