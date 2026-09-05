import type { DateTimeParseResult } from '@frozik/utils/date/fuzzy/types';
import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { DateTimePicker } from './DateTimePicker';
import { blurEditor, editorOf, focusEditor, typeInto } from './editor-test-helpers.test-helper';

const TIME_ZONE = 'UTC';
const TODAY = Temporal.PlainDate.from('2026-03-10');

function parseIsoDate(text: string): DateTimeParseResult {
  try {
    return {
      success: true,
      value: Temporal.PlainDate.from(text).toZonedDateTime({ timeZone: TIME_ZONE }),
    };
  } catch {
    return { success: false, reason: 'not a date' };
  }
}

function ControlledPicker({
  initial,
  onValueChange,
  disabled = false,
  nativePicker,
}: {
  readonly initial: Temporal.ZonedDateTime | undefined;
  readonly onValueChange: (value: Temporal.ZonedDateTime | undefined) => void;
  readonly disabled?: boolean;
  readonly nativePicker?: 'auto' | 'always' | 'never';
}) {
  const [value, setValue] = useState(initial);
  const handleChange = (next: Temporal.ZonedDateTime | undefined) => {
    setValue(next);
    onValueChange(next);
  };
  return (
    <DateTimePicker
      value={value}
      onValueChange={handleChange}
      timeZone={TIME_ZONE}
      onParseInput={parseIsoDate}
      today={TODAY}
      disabled={disabled}
      nativePicker={nativePicker}
    />
  );
}

function selectAll(editor: HTMLElement) {
  return { start: 0, end: (editor.textContent ?? '').length };
}

describe('DateTimePicker', () => {
  it('commits the typed date once when the field loses focus', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledPicker initial={undefined} onValueChange={onValueChange} />
    );
    const editor = editorOf(container);

    typeInto(editor, { data: '2026-01-02', selection: { start: 0, end: 0 } });
    blurEditor(editor);

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]?.toPlainDate().toString()).toBe('2026-01-02');
    expect(editor.textContent).toBe('2026-01-02');
  });

  it('Enter emits the parsed value exactly once', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledPicker initial={undefined} onValueChange={onValueChange} />
    );
    const editor = editorOf(container);

    typeInto(editor, { data: '2026-01-02', selection: { start: 0, end: 0 } });
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('Escape drops the typed text, clears the error and emits nothing', () => {
    const onValueChange = vi.fn();
    const initial = Temporal.PlainDate.from('2026-01-02').toZonedDateTime({ timeZone: TIME_ZONE });
    const { container } = render(
      <ControlledPicker initial={initial} onValueChange={onValueChange} />
    );
    const editor = editorOf(container);

    typeInto(editor, { data: 'garbage', selection: selectAll(editor) });
    fireEvent.keyDown(editor, { key: 'Escape' });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(editor.textContent).toBe('2026-01-02');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps invalid text visible with an error after blur', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledPicker initial={undefined} onValueChange={onValueChange} />
    );
    const editor = editorOf(container);

    typeInto(editor, { data: 'garbage', selection: { start: 0, end: 0 } });
    blurEditor(editor);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(editor.textContent).toBe('garbage');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('not a date');
  });

  it('steps the date with the arrow keys from today when empty', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledPicker initial={undefined} onValueChange={onValueChange} />
    );
    const editor = editorOf(container);
    focusEditor(editor);

    fireEvent.keyDown(editor, { key: 'ArrowUp' });

    expect(onValueChange.mock.calls[0][0]?.toPlainDate().toString()).toBe('2026-03-11');
  });

  it('does not open the calendar or take focus while disabled', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledPicker initial={undefined} onValueChange={onValueChange} disabled />
    );
    const editor = editorOf(container);

    focusEditor(editor);

    expect(editor.hasAttribute('tabindex')).toBe(false);
    expect(editor.getAttribute('contenteditable')).toBe('false');
    expect(document.querySelector('[aria-label="Date picker"]')).toBeNull();
  });

  it('Tab moves the keyboard into the calendar, arrows walk the days and Enter picks one', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledPicker initial={undefined} onValueChange={onValueChange} />
    );
    const editor = editorOf(container);
    focusEditor(editor);

    fireEvent.keyDown(editor, { key: 'Tab' });
    const activeCell = () => document.activeElement;
    expect(activeCell()?.getAttribute('aria-label')).toBe('March 10, 2026');

    fireEvent.keyDown(activeCell() as Element, { key: 'ArrowRight' });
    fireEvent.keyDown(activeCell() as Element, { key: 'ArrowDown' });
    expect(activeCell()?.getAttribute('aria-label')).toBe('March 18, 2026');

    fireEvent.keyDown(activeCell() as Element, { key: 'Enter' });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]?.toPlainDate().toString()).toBe('2026-03-18');
    expect(document.activeElement).toBe(editor);
    expect(editor.textContent).toBe('2026-03-18');
  });

  it('walks into the next month and back to the field with Shift+Tab', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledPicker initial={undefined} onValueChange={onValueChange} />
    );
    const editor = editorOf(container);
    focusEditor(editor);
    fireEvent.keyDown(editor, { key: 'ArrowDown', altKey: true });

    fireEvent.keyDown(document.activeElement as Element, { key: 'PageDown' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('April 10, 2026');
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('April 2026');

    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(editor);
  });

  it('Tab from the days reaches the time spinner, arrows step it and Tab leaves the picker', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <>
        <ControlledPicker initial={undefined} onValueChange={onValueChange} />
        <button type="button">after</button>
      </>
    );
    const editor = editorOf(container);
    focusEditor(editor);
    fireEvent.keyDown(editor, { key: 'Tab' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });

    const hours = document.activeElement;
    expect(hours?.getAttribute('aria-label')).toBe('Hours');
    fireEvent.keyDown(hours as Element, { key: 'ArrowUp' });
    expect(onValueChange.mock.calls[0][0]?.toPlainTime().toString()).toBe('01:00:00');

    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Minutes');

    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(document.activeElement?.textContent).toBe('after');
  });

  it('Escape inside the popup returns the keyboard to the field', () => {
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);
    const editor = editorOf(container);
    focusEditor(editor);
    fireEvent.keyDown(editor, { key: 'Tab' });
    expect(document.activeElement).not.toBe(editor);

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });

    expect(document.activeElement).toBe(editor);
  });

  it('commits the value picked through the native input', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledPicker initial={undefined} onValueChange={onValueChange} nativePicker="always" />
    );
    const native = container.querySelector<HTMLInputElement>('input[type="datetime-local"]');
    if (native === null) {
      throw new Error('native input not rendered');
    }

    act(() => {
      fireEvent.change(native, { target: { value: '2026-05-06T07:08' } });
    });

    expect(onValueChange.mock.calls[0][0]?.toString()).toBe('2026-05-06T07:08:00+00:00[UTC]');
    expect(editorOf(container).textContent).toBe('2026-05-06 07:08');
  });

  it('renders no native picker for fine pointers by default', () => {
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);

    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
  });

  it('keeps the keyboard in the field when the popup reopens after a keyboard visit', () => {
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);
    const editor = editorOf(container);
    focusEditor(editor);
    fireEvent.keyDown(editor, { key: 'Tab' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    blurEditor(editor);

    focusEditor(editor);

    expect(document.activeElement).toBe(editor);
    expect(document.querySelector('[aria-label="Date picker"]')).not.toBeNull();
  });
});
