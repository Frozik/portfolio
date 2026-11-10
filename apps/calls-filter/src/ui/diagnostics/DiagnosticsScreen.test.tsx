import { fireEvent, screen } from 'expo-router/testing-library';

import DiagnosticsRoute from '../../app/diagnostics';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';

const ROUTES = { diagnostics: DiagnosticsRoute };

describe('the diagnostics', () => {
  it('keep the call log as long as chosen, and tell the screening service so', async () => {
    const phone = fakePhone();
    await renderApp(ROUTES, { phone, initialUrl: '/diagnostics' });

    await fireEvent.press(await screen.findByTestId('diagnostics-journal-days'));
    await fireEvent.press(await screen.findByTestId('journal-days-180'));

    expect(phone.preferences().journalDays).toBe(180);
    expect(phone.retentionDays()).toBe(180);
  });

  it('tell the screening service the kept term on start, so the two never differ', async () => {
    const phone = fakePhone();
    await renderApp(ROUTES, { phone, initialUrl: '/diagnostics' });

    await screen.findByTestId('diagnostics-journal-days');
    expect(phone.retentionDays()).toBe(phone.preferences().journalDays);
  });

  it('show only the problems once they are picked from the list', async () => {
    await renderApp(ROUTES, { initialUrl: '/diagnostics' });

    await fireEvent.press(await screen.findByTestId('diagnostics-filter'));
    await fireEvent.press(await screen.findByTestId('diagnostics-errors'));

    expect(await screen.findByTestId('diagnostics-empty')).toBeOnTheScreen();
  });
});
