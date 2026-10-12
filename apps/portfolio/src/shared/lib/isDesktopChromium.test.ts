import { isDesktopChromium } from './isDesktopChromium';

const chromium = (mobile: boolean) => ({
  userAgentData: {
    mobile,
    brands: [{ brand: 'Google Chrome' }, { brand: 'Chromium' }, { brand: 'Not A(Brand' }],
  },
});

describe('isDesktopChromium', () => {
  it('tells a Chromium browser on a computer', () => {
    expect(isDesktopChromium(chromium(false))).toBe(true);
  });

  it('leaves out a phone, and browsers that are not Chromium', () => {
    expect(isDesktopChromium(chromium(true))).toBe(false);
    expect(isDesktopChromium({})).toBe(false);
    expect(
      isDesktopChromium({ userAgentData: { mobile: false, brands: [{ brand: 'Other' }] } })
    ).toBe(false);
  });
});
