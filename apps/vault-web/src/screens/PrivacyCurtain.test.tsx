import { act, render, screen } from '@testing-library/react';

import { PrivacyCurtain } from './PrivacyCurtain';

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('the privacy curtain', () => {
  afterEach(() => setVisibility('visible'));

  it('covers the app while it is out of sight, and lifts when it comes back', () => {
    render(<PrivacyCurtain />);
    const shownAtFirst = screen.queryByTestId('privacy-curtain');

    setVisibility('hidden');
    const whileHidden = screen.queryByTestId('privacy-curtain');
    setVisibility('visible');

    expect(shownAtFirst).toBeNull();
    expect(whileHidden).not.toBeNull();
    expect(screen.queryByTestId('privacy-curtain')).toBeNull();
  });
});
