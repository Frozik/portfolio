import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import * as agentTools from './editor-agent-tools';
import type { ISecretInputFormat } from './secret-input';
import { SecretEditor } from './SecretEditor';

const ignore = (): void => undefined;

function ControlledSecret({
  initial = '',
  onValueChange = ignore,
  format,
  revealTimeoutMs,
}: {
  readonly initial?: string;
  readonly onValueChange?: (value: string) => void;
  readonly format?: ISecretInputFormat;
  readonly revealTimeoutMs?: number;
}) {
  const [value, setValue] = useState(initial);
  const handleChange = (next: string) => {
    setValue(next);
    onValueChange(next);
  };
  return (
    <>
      <SecretEditor
        value={value}
        onValueChange={handleChange}
        format={format}
        revealTimeoutMs={revealTimeoutMs}
      />
      <button type="button">after</button>
    </>
  );
}

const input = (): HTMLInputElement => screen.getByLabelText('Secret input');
const toggle = (): HTMLElement => screen.getByRole('button', { pressed: false });

describe('SecretEditor', () => {
  it('is a password field that no other password manager, Grammarly or spell checker touches', () => {
    render(<ControlledSecret initial="hunter2" />);

    expect(input().type).toBe('password');
    for (const [attribute, value] of [
      ['autocomplete', 'off'],
      ['spellcheck', 'false'],
      ['data-1p-ignore', 'true'],
      ['data-lpignore', 'true'],
      ['data-bwignore', 'true'],
      ['data-form-type', 'other'],
      ['data-gramm', 'false'],
    ]) {
      expect(input().getAttribute(attribute)).toBe(value);
    }
  });

  it('shows the value on request, says so, and keeps every guard while shown', () => {
    render(<ControlledSecret initial="hunter2" />);

    fireEvent.click(toggle());

    expect(input().type).toBe('text');
    expect(screen.getByRole('button', { pressed: true }).textContent).toBe('Hide');
    expect(input().getAttribute('data-1p-ignore')).toBe('true');
  });

  it('hides a shown value again after the owner’s timeout', () => {
    vi.useFakeTimers();
    try {
      render(<ControlledSecret initial="hunter2" revealTimeoutMs={30_000} />);
      fireEvent.click(toggle());

      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(input().type).toBe('password');
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes only digits for a PIN and opens the numeric keyboard', () => {
    const onValueChange = vi.fn();
    render(
      <ControlledSecret format={{ digitsOnly: true, maxLength: 6 }} onValueChange={onValueChange} />
    );

    fireEvent.change(input(), { target: { value: '12a' } });
    fireEvent.change(input(), { target: { value: '0420' } });

    expect(input().inputMode).toBe('numeric');
    expect(onValueChange.mock.calls).toEqual([['0420']]);
  });

  it('puts the value back on Escape and moves on with Enter', () => {
    const onValueChange = vi.fn();
    render(<ControlledSecret initial="old" onValueChange={onValueChange} />);

    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'new' } });
    fireEvent.keyDown(input(), { key: 'Escape' });

    expect(onValueChange).toHaveBeenLastCalledWith('old');
    act(() => input().focus());
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(document.activeElement?.textContent).toBe('Show');
  });

  it('has no agent tools: an agent must not read or type a secret', () => {
    expect(Object.keys(agentTools).filter(name => /secret/i.test(name))).toEqual([]);
  });

  it('lets the browser remember a master password, and submits it with Enter when the owner asks', () => {
    const onEnter = vi.fn();
    render(<SecretEditor value="" autoComplete="current-password" onEnter={onEnter} />);

    expect(input().getAttribute('autocomplete')).toBe('current-password');
    expect(input().getAttribute('data-gramm')).toBe('false');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onEnter).toHaveBeenCalledOnce();
  });
});
