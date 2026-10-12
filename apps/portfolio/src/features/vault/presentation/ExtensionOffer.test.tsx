import { fireEvent, render, screen } from '@testing-library/react';

import { ExtensionOffer } from './ExtensionOffer';

function browse(userAgentData: unknown) {
  Object.defineProperty(navigator, 'userAgentData', { value: userAgentData, configurable: true });
}

describe('ExtensionOffer', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => browse(undefined));

  it('points a desktop Chromium browser to the latest release, until hidden for good', () => {
    browse({ mobile: false, brands: [{ brand: 'Chromium' }] });
    const { unmount } = render(<ExtensionOffer />);

    expect(screen.getByRole('link', { name: 'Download from GitHub' }).getAttribute('href')).toBe(
      'https://github.com/frozik/portfolio/releases/latest'
    );
    expect(
      screen.getByRole('link', { name: 'latest release on GitHub' }).getAttribute('href')
    ).toBe('https://github.com/frozik/portfolio/releases/latest');
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Password Vault for Chrome')).toBeNull();

    unmount();
    render(<ExtensionOffer />);
    expect(screen.queryByText('Password Vault for Chrome')).toBeNull();
  });

  it('offers nothing where Chrome extensions do not run', () => {
    browse(undefined);
    render(<ExtensionOffer />);

    expect(screen.queryByText('Password Vault for Chrome')).toBeNull();
  });
});
