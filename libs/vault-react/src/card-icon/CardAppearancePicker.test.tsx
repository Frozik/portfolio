import { fireEvent, render, screen } from '@testing-library/react';

import type { TCardColor, TCardIconRef } from '@frozik/vault/model/card';
import { CardAppearancePicker } from './CardAppearancePicker';

function renderPicker(icon: TCardIconRef, extra: { readonly autoPicture?: string } = {}) {
  const colors: (TCardColor | null)[] = [];
  const icons: TCardIconRef[] = [];
  render(
    <CardAppearancePicker
      color="teal"
      icon={icon}
      locale="en"
      onColorChange={color => colors.push(color)}
      onIconChange={next => icons.push(next)}
      {...extra}
    />
  );
  return { colors, icons };
}

const iconField = () => screen.getByRole('combobox', { name: 'Icon' });

describe('CardAppearancePicker', () => {
  it('offers the built-in icons by group and hands over the one picked', () => {
    const { icons } = renderPicker({ kind: 'auto' });

    expect(iconField().textContent).toContain('Automatic');
    fireEvent.click(iconField());
    const finance = screen.getByRole('group', { name: 'Finance' });
    expect(finance.textContent).toContain('Bank');
    fireEvent.click(screen.getByRole('option', { name: 'Bank' }));

    expect(icons).toEqual([{ kind: 'builtin', name: 'landmark' }]);
  });

  it('asks for a colour only for a built-in icon, the only one a colour reaches', () => {
    renderPicker({ kind: 'auto' });

    expect(screen.queryByRole('combobox', { name: 'Colour' })).toBeNull();
  });

  it('shows the chosen colour of a built-in icon and hands over a new one or none', () => {
    const { colors } = renderPicker({ kind: 'builtin', name: 'key' });
    const colorField = screen.getByRole('combobox', { name: 'Colour' });

    expect(colorField.textContent).toContain('Teal');
    fireEvent.click(colorField);
    fireEvent.click(screen.getByRole('option', { name: 'Violet' }));
    fireEvent.click(colorField);
    fireEvent.click(screen.getByRole('option', { name: 'No colour' }));

    expect(colors).toEqual(['violet', null]);
  });

  it('shows the site’s icon on the automatic choice', () => {
    renderPicker({ kind: 'auto' }, { autoPicture: 'blob:site-icon' });

    expect(iconField().querySelector('img')?.getAttribute('src')).toBe('blob:site-icon');
  });
});
