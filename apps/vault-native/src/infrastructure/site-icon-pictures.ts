import { fromBase64, toBase64 } from '@frozik/vault/crypto/bytes';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { isNil } from 'lodash-es';

import type { TNormalizeSiteIcon } from '@frozik/vault-http/document/site-icon-fetcher';
import { SITE_ICON_SIDE } from '@frozik/vault-http/document/site-icon-fetcher';

/**
 * The served picture shrunk to fit the icon's square, as PNG. Android's manipulator cannot pad
 * (`extent` is web-only), so a picture that is not square stays its own shape and the row centres
 * it. A format Android cannot decode (SVG) reads as no picture, and the next service is asked.
 */
export const fitSiteIconOnPhone: TNormalizeSiteIcon = async (picture, mime) => {
  const source = `data:${mime};base64,${toBase64(picture)}`;
  try {
    const decoded = await ImageManipulator.manipulate(source).renderAsync();
    const scale = Math.min(SITE_ICON_SIDE / decoded.width, SITE_ICON_SIDE / decoded.height, 1);
    const size = {
      width: Math.round(decoded.width * scale),
      height: Math.round(decoded.height * scale),
    };
    decoded.release();
    const fitted = await ImageManipulator.manipulate(source).resize(size).renderAsync();
    const saved = await fitted.saveAsync({ format: SaveFormat.PNG, base64: true });
    fitted.release();
    new File(saved.uri).delete();
    return isNil(saved.base64) ? null : fromBase64(saved.base64);
  } catch {
    return null;
  }
};
