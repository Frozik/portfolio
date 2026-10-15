import { installStateOf } from './install-state';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const TAB = { standalone: false, displayModeStandalone: false };

describe('the install state', () => {
  it('asks an iPhone or iPad in a browser tab to install first', () => {
    expect(installStateOf({ userAgent: IPHONE, maxTouchPoints: 5, ...TAB })).toBe('iphone-browser');
    expect(installStateOf({ userAgent: MAC, maxTouchPoints: 5, ...TAB })).toBe('iphone-browser');
  });

  it('leaves a Mac, an Android phone and any installed app alone', () => {
    expect(installStateOf({ userAgent: MAC, maxTouchPoints: 0, ...TAB })).toBe('browser');
    expect(installStateOf({ userAgent: ANDROID, maxTouchPoints: 5, ...TAB })).toBe('browser');
    expect(
      installStateOf({
        userAgent: IPHONE,
        maxTouchPoints: 5,
        standalone: true,
        displayModeStandalone: false,
      })
    ).toBe('installed');
  });
});
