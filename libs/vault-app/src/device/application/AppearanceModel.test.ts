import { createFakeThemeStore } from '../../testing/fake-theme-store';
import { AppearanceModel } from './AppearanceModel';

describe('the appearance', () => {
  it('follows the system until the user chooses', () => {
    const device = createFakeThemeStore('system', false);
    const appearance = new AppearanceModel(device.store);

    expect(appearance.scheme).toBe('light');
    device.setSystemDark(true);
    expect(appearance.scheme).toBe('dark');
  });

  it('keeps the user’s choice whatever the system says, and remembers it on this device', () => {
    const device = createFakeThemeStore('system', true);
    const appearance = new AppearanceModel(device.store);

    appearance.choose('light');
    device.setSystemDark(true);

    expect(appearance.scheme).toBe('light');
    expect(device.stored()).toBe('light');
    expect(new AppearanceModel(device.store).preference).toBe('light');
  });

  it('stops listening to the system once disposed', () => {
    const device = createFakeThemeStore();
    const appearance = new AppearanceModel(device.store);

    appearance.dispose();

    expect(device.listeners()).toBe(0);
  });
});
