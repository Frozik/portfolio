import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { Tabs } from './Tabs';

type TTabId = 'main' | 'bank';

function CardTabs({ onTab }: { readonly onTab: (id: TTabId) => void }) {
  const [value, setValue] = useState<TTabId>('main');
  const handleChange = (id: TTabId) => {
    setValue(id);
    onTab(id);
  };
  return (
    <Tabs
      aria-label="Card"
      value={value}
      onValueChange={handleChange}
      tabs={[
        { id: 'main', label: 'Main', content: 'login and password' },
        { id: 'bank', label: 'Bank', content: 'IBAN and BIC' },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('shows the panel of the chosen tab and reports its id', () => {
    const onTab = vi.fn();
    render(<CardTabs onTab={onTab} />);

    expect(screen.getByRole('tabpanel').textContent).toBe('login and password');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Bank' }), { button: 0, ctrlKey: false });

    expect(onTab).toHaveBeenLastCalledWith('bank');
    expect(screen.getByRole('tabpanel').textContent).toBe('IBAN and BIC');
    expect(screen.getByRole('tablist').getAttribute('aria-label')).toBe('Card');
  });

  it('puts its actions at the end of the bar, outside the tab list', () => {
    render(
      <Tabs
        aria-label="Card"
        value="main"
        onValueChange={vi.fn()}
        tabs={[{ id: 'main', label: 'Main', content: 'fields' }]}
        actions={<button type="button">Add a tab</button>}
      />
    );

    const add = screen.getByRole('button', { name: 'Add a tab' });
    expect(screen.getByRole('tablist').contains(add)).toBe(false);
    expect(screen.getByRole('tablist').parentElement?.contains(add)).toBe(true);
  });
});
