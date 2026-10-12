import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Temporal } from 'temporal-polyfill';

import { TotpCode } from './TotpCode';

/** RFC 6238 appendix B: the SHA-1 secret "12345678901234567890" in base32, 8 digits, 30-second steps. */
const RFC_URI =
  'otpauth://totp/Test:alice?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&digits=8&period=30&issuer=Test';

/** Waits for the code's once-a-second tick, it does not time it: slow CI runners get room. */
const NEXT_TICK_TIMEOUT_MS = 10_000;

describe('TotpCode', () => {
  it('shows the code of the moment and copies the code, not the secret', async () => {
    const at = Temporal.Instant.fromEpochMilliseconds(59_000);
    const copied: string[] = [];
    render(
      <TotpCode uri={RFC_URI} now={() => at} locale="en" onCopy={code => copied.push(code)} />
    );

    await waitFor(() =>
      expect(screen.getByLabelText('One-time code').textContent).toBe('942 87082')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(copied).toEqual(['94287082']);
  });

  it('turns to the next code when its period ends', async () => {
    let at = Temporal.Instant.fromEpochMilliseconds(59_000);
    render(<TotpCode uri={RFC_URI} now={() => at} locale="en" onCopy={() => undefined} />);
    const code = (): string | null => screen.getByLabelText('One-time code').textContent;
    await waitFor(() => expect(code()).toBe('942 87082'));

    at = Temporal.Instant.fromEpochMilliseconds(61_000);

    await waitFor(() => expect(code()).not.toBe('942 87082'), { timeout: NEXT_TICK_TIMEOUT_MS });
    expect(code()).not.toBe('');
  });

  it('turns orange with twenty seconds left and red under ten', () => {
    const urgencyAt = (ms: number): string | null => {
      const { container, unmount } = render(
        <TotpCode
          uri={RFC_URI}
          now={() => Temporal.Instant.fromEpochMilliseconds(ms)}
          locale="en"
          onCopy={() => undefined}
        />
      );
      const urgency = container.firstElementChild?.getAttribute('data-urgency') ?? null;
      unmount();
      return urgency;
    };

    expect(urgencyAt(35_000)).toBe('calm');
    expect(urgencyAt(40_000)).toBe('soon');
    expect(urgencyAt(50_000)).toBe('soon');
    expect(urgencyAt(51_000)).toBe('urgent');
  });

  it('says so for a secret it cannot read', () => {
    render(
      <TotpCode
        uri="not a code"
        now={() => Temporal.Now.instant()}
        locale="en"
        onCopy={() => undefined}
      />
    );

    expect(screen.getByTestId('totp-unreadable')).toBeTruthy();
  });
});
