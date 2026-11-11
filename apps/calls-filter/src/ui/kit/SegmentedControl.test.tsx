import { NATIVE_PALETTES } from '@frozik/components/tokens/native-tokens';
import { act, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { SegmentedControl } from './SegmentedControl';

const LIT = { backgroundColor: NATIVE_PALETTES.light.accent };
/** Longer than the slide of the highlight from one segment to the next. */
const AFTER_SLIDE_MS = 1000;

function Tabs({ value }: { readonly value: 'calls' | 'rules' }) {
  const segments: ComponentProps<typeof SegmentedControl<'calls' | 'rules'>>['segments'] = [
    { value: 'calls', label: 'Calls', testID: 'tab-calls' },
    { value: 'rules', label: 'Rules', testID: 'tab-rules' },
  ];
  return <SegmentedControl segments={segments} value={value} onChange={() => {}} />;
}

describe('a segmented switch', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('lights the chosen segment itself from its first frame, before any animation has run', async () => {
    await render(<Tabs value="calls" />);

    expect(screen.getByTestId('tab-calls')).toHaveStyle(LIT);
    expect(screen.getByTestId('tab-rules')).not.toHaveStyle(LIT);
  });

  it('hands the light to the newly chosen segment once the highlight has slid there', async () => {
    jest.useFakeTimers();
    const rendered = await render(<Tabs value="calls" />);
    await rendered.rerender(<Tabs value="rules" />);

    expect(screen.getByTestId('tab-rules')).not.toHaveStyle(LIT);
    await act(() => jest.advanceTimersByTime(AFTER_SLIDE_MS));

    expect(screen.getByTestId('tab-rules')).toHaveStyle(LIT);
    expect(screen.getByTestId('tab-calls')).not.toHaveStyle(LIT);
  });
});
