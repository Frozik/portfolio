import { fireEvent, render, screen } from '@testing-library/react-native';

import { aDevice } from '@frozik/vault-app/testing/fake-device';

import { AppUnderTest } from '../testing/AppUnderTest';
import { PatternPad } from './PatternPad';

const FIRST_POINT = { pageX: 44, pageY: 44 };
const CENTRE_POINT = { pageX: 132, pageY: 132 };
const BETWEEN_POINTS = { pageX: 100, pageY: 60 };

function touch(at: { readonly pageX: number; readonly pageY: number }) {
  return {
    nativeEvent: { ...at, touches: [], changedTouches: [] },
    touchHistory: { touchBank: [] },
  };
}

async function drawnPad() {
  const onComplete = jest.fn();
  await render(
    <AppUnderTest app={aDevice().startStore()}>
      <PatternPad onComplete={onComplete} />
    </AppUnderTest>
  );
  const pad = screen.getByTestId('pattern-pad');
  await fireEvent(pad, 'responderGrant', touch(FIRST_POINT));
  await fireEvent(pad, 'responderMove', touch(CENTRE_POINT));
  return { pad, onComplete };
}

describe('drawing a pattern', () => {
  it('sends what was drawn when the finger lifts', async () => {
    const { pad, onComplete } = await drawnPad();

    await fireEvent(pad, 'responderRelease', touch(CENTRE_POINT));

    expect(onComplete).toHaveBeenCalledWith([0, 4]);
  });

  it('draws the line through the points joined so far', async () => {
    await drawnPad();

    expect(screen.getByTestId('pattern-line', { includeHiddenElements: true }).props.d).toBe(
      'M44 44 132 132 132 132'
    );
  });

  it('draws on from the last point to the finger while it moves between points', async () => {
    const onComplete = jest.fn();
    await render(
      <AppUnderTest app={aDevice().startStore()}>
        <PatternPad onComplete={onComplete} />
      </AppUnderTest>
    );
    const pad = screen.getByTestId('pattern-pad');

    await fireEvent(pad, 'responderGrant', touch(FIRST_POINT));
    await fireEvent(pad, 'responderMove', touch(BETWEEN_POINTS));

    expect(screen.getByTestId('pattern-line', { includeHiddenElements: true }).props.d).toBe(
      'M44 44 100 60'
    );
  });

  it('keeps the drawing from a scroll that asks for the touch', async () => {
    const { pad } = await drawnPad();

    expect(pad.props.onResponderTerminationRequest(touch(CENTRE_POINT))).toBe(false);
  });

  it('throws away a drawing the system took over, never sending half a pattern', async () => {
    const { pad, onComplete } = await drawnPad();

    await fireEvent(pad, 'responderTerminate', touch(CENTRE_POINT));

    expect(onComplete).not.toHaveBeenCalled();
  });
});
