import { Font } from '@react-pdf/renderer';

export const PDF_FONT_FAMILY = 'Inter';

const INTER_REGULAR = new URL('../assets/fonts/Inter-Regular.ttf', import.meta.url).href;
const INTER_BOLD = new URL('../assets/fonts/Inter-Bold.ttf', import.meta.url).href;

let registered = false;

export function ensurePdfFontsRegistered(): void {
  if (registered) {
    return;
  }
  registered = true;

  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: INTER_REGULAR, fontWeight: 400 },
      { src: INTER_BOLD, fontWeight: 700 },
    ],
  });

  Font.registerHyphenationCallback(word => [word]);
}
