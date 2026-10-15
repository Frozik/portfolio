import { fireEvent, render, screen } from '@testing-library/react';

import { assert } from '@frozik/utils/assert/assert';
import { AppearanceModel } from '@frozik/vault-app/device/application/AppearanceModel';
import { createFakeThemeStore } from '@frozik/vault-app/testing/fake-theme-store';
import { vaultT } from '../texts/vault';
import { ThemeMenu } from './ThemeMenu';

function renderMenu() {
  const appearance = new AppearanceModel(createFakeThemeStore('system', false).store);
  render(<ThemeMenu appearance={appearance} texts={vaultT.appearance} />);
  const menu = screen.getByTestId('appearance');
  const option = (value: string) => {
    const found = menu.querySelector(`[data-value="${value}"]`);
    assert(found instanceof HTMLButtonElement);
    return found;
  };
  return { appearance, menu, option };
}

describe('ThemeMenu', () => {
  it('opens from the chosen theme and closes again on a second press', () => {
    const { menu, option } = renderMenu();

    fireEvent.click(option('system'));
    expect(menu.dataset.open).toBe('true');
    fireEvent.click(option('system'));
    expect(menu.dataset.open).toBe('false');
  });

  it('applies another theme and folds back to its icon', () => {
    const { appearance, menu, option } = renderMenu();

    fireEvent.click(option('system'));
    fireEvent.click(option('dark'));

    expect(appearance.preference).toBe('dark');
    expect(menu.dataset.state).toBe('dark');
    expect(menu.dataset.open).toBe('false');
    expect(screen.getByRole('radio', { checked: true }).dataset.value).toBe('dark');
  });

  it('closes when the user taps elsewhere', () => {
    const { menu, option } = renderMenu();

    fireEvent.click(option('system'));
    fireEvent.pointerDown(document.body);

    expect(menu.dataset.open).toBe('false');
  });
});
