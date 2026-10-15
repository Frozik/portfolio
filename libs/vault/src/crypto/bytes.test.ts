import { fromBase64, fromBase64Url, toBase64, toBase64Url } from './bytes';

const BYTES = Uint8Array.of(0xfb, 0xff, 0x00, 0x89, 0x50);

describe('base64', () => {
  it('writes the padded alphabet a data URI carries, and reads it back', () => {
    expect([toBase64(BYTES), fromBase64(toBase64(BYTES))]).toEqual(['+/8AiVA=', BYTES]);
  });

  it('writes the URL alphabet without padding, and reads it back', () => {
    expect([toBase64Url(BYTES), fromBase64Url(toBase64Url(BYTES))]).toEqual(['-_8AiVA', BYTES]);
  });

  it('reads text that is no base64 as nothing', () => {
    expect([fromBase64('not base64!'), fromBase64Url('+/8=')]).toEqual([null, null]);
  });
});
