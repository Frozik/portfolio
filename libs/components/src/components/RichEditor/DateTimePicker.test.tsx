import type { DateTimeParseResult, IParseContext } from '@frozik/utils/date/fuzzy/types';
import { act, fireEvent, render } from '@testing-library/react';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { POPUP_RETRACT_DELAY_MS } from './components/PopupDrawer';
import { DateTimePicker } from './DateTimePicker';
import { blurEditor, editorOf, focusEditor, typeInto } from './editor-test-helpers.test-helper';

const TIME_ZONE = 'UTC';
const TODAY = Temporal.PlainDate.from('2026-03-10');
const NOW = Temporal.Instant.from('2026-03-10T09:30:00Z');

function getNow(): Temporal.Instant {
  return NOW;
}

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

function parseWithContext(text: string, _context: IParseContext): DateTimeParseResult {
  return parseIsoDate(text);
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
      getNow={getNow}
      onParseInput={parseIsoDate}
      today={TODAY}
      disabled={disabled}
      nativePicker={nativePicker}
    />
  );
}

function drawerOf(): HTMLElement {
  const drawer = document.querySelector('[aria-label="Date picker"]')?.parentElement;
  if (isNil(drawer)) {
    throw new Error('no popup rendered');
  }
  return drawer;
}

function handleOf(root: ParentNode): HTMLElement {
  const handle = root.querySelector<HTMLElement>('[aria-label="Calendar popup"]');
  if (isNil(handle)) {
    throw new Error('no popup handle rendered');
  }
  return handle;
}

function sheetOf(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>('dialog');
}

/** The tab under the field, as opposed to the sheet's own handle. */
function tabOf(): HTMLElement {
  const tab = [...document.querySelectorAll<HTMLElement>('[aria-label="Calendar popup"]')].find(
    handle => isNil(handle.closest('dialog'))
  );
  if (isNil(tab)) {
    throw new Error('no tab rendered');
  }
  return tab;
}

const COARSE_POINTER_QUERY = '(pointer: coarse)';

function pretendCoarsePointer(): void {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation(query => {
    const list = matchMedia(query);
    // happy-dom's list keeps private fields, so its methods only run bound to the real object.
    return new Proxy(list, {
      get: (target, key) => {
        if (key === 'matches' && query === COARSE_POINTER_QUERY) {
          return true;
        }
        const member: unknown = Reflect.get(target, key, target);
        return typeof member === 'function' ? member.bind(target) : member;
      },
    });
  });
}

function selectAll(editor: HTMLElement) {
  return { start: 0, end: (editor.textContent ?? '').length };
}

function letTimePass(milliseconds: number): void {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe('DateTimePicker', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it('refuses to draw itself in a time zone that does not exist', () => {
    const reactReport = vi.spyOn(console, 'error').mockReturnValue(undefined);

    expect(() =>
      render(<DateTimePicker timeZone="Europe/Berln" getNow={getNow} onParseInput={parseIsoDate} />)
    ).toThrow('DateTimePicker: unknown time zone "Europe/Berln"');

    reactReport.mockRestore();
  });

  it('hands the text to the parser with the moment of its clock and its own zone', () => {
    const onParseInput = vi.fn(parseWithContext);
    const { container } = render(
      <DateTimePicker timeZone="Pacific/Auckland" getNow={getNow} onParseInput={onParseInput} />
    );
    const editor = editorOf(container);

    typeInto(editor, { data: '2026-01-02', selection: { start: 0, end: 0 } });
    blurEditor(editor);

    expect(onParseInput).toHaveBeenCalledExactlyOnceWith('2026-01-02', {
      now: NOW,
      timeZone: 'Pacific/Auckland',
    });
  });

  it('asks the clock when the text is read, not when the picker was drawn', () => {
    const later = NOW.add({ hours: 2 });
    const clock = vi.fn(getNow);
    const onParseInput = vi.fn(parseWithContext);
    const { container } = render(
      <DateTimePicker timeZone={TIME_ZONE} getNow={clock} onParseInput={onParseInput} />
    );
    const editor = editorOf(container);

    clock.mockReturnValue(later);
    typeInto(editor, { data: '2026-01-02', selection: { start: 0, end: 0 } });
    blurEditor(editor);

    expect(onParseInput).toHaveBeenCalledExactlyOnceWith('2026-01-02', {
      now: later,
      timeZone: TIME_ZONE,
    });
  });

  it('takes today from its clock when no day is given, so a clock in the past moves the whole picker', () => {
    const onValueChange = vi.fn();
    const inThePast = () => Temporal.Instant.from('2019-07-04T22:30:00Z');
    const { container } = render(
      <DateTimePicker
        timeZone="Pacific/Auckland"
        getNow={inThePast}
        onParseInput={parseIsoDate}
        onValueChange={onValueChange}
      />
    );
    const editor = editorOf(container);

    focusEditor(editor);
    fireEvent.keyDown(editor, { key: 'ArrowUp' });

    expect(onValueChange.mock.calls[0][0]?.toPlainDate().toString()).toBe('2019-07-06');
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

  it('shows only the edge of the popup on focus and pulls it out while the mouse is over it', () => {
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);
    focusEditor(editorOf(container));
    const drawer = drawerOf();

    expect(drawer.hasAttribute('data-expanded')).toBe(false);

    fireEvent.pointerEnter(drawer, { pointerType: 'mouse' });
    expect(drawer.hasAttribute('data-expanded')).toBe(true);
  });

  it('stays out for a moment after the mouse leaves, then slides back', () => {
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);
    focusEditor(editorOf(container));
    const drawer = drawerOf();
    fireEvent.pointerEnter(drawer, { pointerType: 'mouse' });
    vi.useFakeTimers();

    fireEvent.pointerLeave(drawer, { pointerType: 'mouse' });
    letTimePass(POPUP_RETRACT_DELAY_MS - 1);
    expect(drawer.hasAttribute('data-expanded')).toBe(true);

    letTimePass(1);
    expect(drawer.hasAttribute('data-expanded')).toBe(false);
  });

  it('stays out when the mouse comes back before the moment is over', () => {
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);
    focusEditor(editorOf(container));
    const drawer = drawerOf();
    fireEvent.pointerEnter(drawer, { pointerType: 'mouse' });
    vi.useFakeTimers();

    fireEvent.pointerLeave(drawer, { pointerType: 'mouse' });
    letTimePass(POPUP_RETRACT_DELAY_MS - 1);
    fireEvent.pointerEnter(drawer, { pointerType: 'mouse' });
    letTimePass(POPUP_RETRACT_DELAY_MS * 2);

    expect(drawer.hasAttribute('data-expanded')).toBe(true);
  });

  it('keeps the popup pulled out while the keyboard is inside it', () => {
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);
    const editor = editorOf(container);
    focusEditor(editor);

    fireEvent.keyDown(editor, { key: 'Tab' });
    expect(drawerOf().hasAttribute('data-expanded')).toBe(true);
    vi.useFakeTimers();

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    letTimePass(POPUP_RETRACT_DELAY_MS);

    expect(drawerOf().hasAttribute('data-expanded')).toBe(false);
  });

  it('a tap keeps the popup pulled out, since a touch never hovers', () => {
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);
    focusEditor(editorOf(container));
    const drawer = drawerOf();

    fireEvent.pointerEnter(drawer, { pointerType: 'touch' });
    fireEvent.pointerLeave(drawer, { pointerType: 'touch' });
    expect(drawer.hasAttribute('data-expanded')).toBe(false);

    fireEvent.click(handleOf(drawer));

    expect(drawer.hasAttribute('data-expanded')).toBe(true);
  });

  it('on touch the handle opens the calendar as a sheet from the bottom of the screen', () => {
    pretendCoarsePointer();
    const onValueChange = vi.fn();
    const { container } = render(
      <ControlledPicker initial={undefined} onValueChange={onValueChange} />
    );
    const editor = editorOf(container);
    focusEditor(editor);
    expect(sheetOf()?.open).toBe(false);
    expect(document.querySelector('[data-expanded]')).toBeNull();

    fireEvent.click(tabOf());

    const sheet = sheetOf();
    expect(sheet?.open).toBe(true);
    expect(sheet?.querySelector('[aria-label="Days of the month"]')).not.toBeNull();
    expect(document.activeElement).not.toBe(editor);
    expect(() => tabOf()).toThrow('no tab rendered');

    fireEvent.click(sheet?.querySelector('[aria-label="March 18, 2026"]') as Element);
    expect(onValueChange.mock.calls[0][0]?.toPlainDate().toString()).toBe('2026-03-18');
    expect(editor.textContent).toBe('2026-03-18');
    expect(sheet?.open).toBe(true);

    fireEvent.click(handleOf(sheet as ParentNode));

    expect(sheet?.open).toBe(false);
    expect(document.activeElement).not.toBe(editor);
  });

  it('a tap on the backdrop or Escape shuts the sheet, and the tab goes with the blurred field', () => {
    pretendCoarsePointer();
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);
    const editor = editorOf(container);
    focusEditor(editor);
    fireEvent.click(tabOf());
    const sheet = sheetOf() as HTMLDialogElement;
    expect(sheet.open).toBe(true);

    fireEvent.click(sheet);
    expect(sheet.open).toBe(false);
    expect(() => tabOf()).toThrow('no tab rendered');

    focusEditor(editor);
    fireEvent.click(tabOf());
    expect(sheet.open).toBe(true);
    act(() => {
      sheet.close();
    });
    expect(sheet.open).toBe(false);

    focusEditor(editor);
    fireEvent.click(tabOf());
    expect(sheet.open).toBe(true);
  });

  it('shows six weeks for every month, so the popup keeps its size while months are browsed', () => {
    const { container } = render(<ControlledPicker initial={undefined} onValueChange={vi.fn()} />);
    focusEditor(editorOf(container));
    const dayCount = () => document.querySelectorAll('button[aria-pressed]').length;
    const daysInSixWeeks = 42;

    expect(dayCount()).toBe(daysInSixWeeks);

    fireEvent.click(document.querySelector('[aria-label="Previous month"]') as Element);

    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('February 2026');
    expect(dayCount()).toBe(daysInSixWeeks);
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
