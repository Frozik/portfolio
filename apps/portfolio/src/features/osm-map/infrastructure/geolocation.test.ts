import { requestCurrentPosition } from './geolocation';

type SuccessCallback = (position: { coords: { latitude: number; longitude: number } }) => void;
type ErrorCallback = (error: { code: number }) => void;

function stubGeolocation(): {
  deliver: (lat: number, lon: number) => void;
  fail: (code: number) => void;
} {
  let success: SuccessCallback | undefined;
  let failure: ErrorCallback | undefined;
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (onSuccess: SuccessCallback, onError: ErrorCallback) => {
        success = onSuccess;
        failure = onError;
      },
    },
  });
  return {
    deliver: (latitude, longitude) => success?.({ coords: { latitude, longitude } }),
    fail: code => failure?.({ code }),
  };
}

describe('requestCurrentPosition', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports the fix as a longitude/latitude pair', () => {
    const { deliver } = stubGeolocation();
    const onPosition = vi.fn();

    requestCurrentPosition(onPosition);
    deliver(48.8566, 2.3522);

    expect(onPosition).toHaveBeenCalledWith({ lat: 48.8566, lon: 2.3522 });
  });

  it('drops a fix that arrives after cancellation', () => {
    const { deliver } = stubGeolocation();
    const onPosition = vi.fn();

    const cancel = requestCurrentPosition(onPosition);
    cancel();
    deliver(48.8566, 2.3522);

    expect(onPosition).not.toHaveBeenCalled();
  });

  it('names the failure the browser reported', () => {
    const { fail } = stubGeolocation();
    const onFailure = vi.fn();

    requestCurrentPosition(vi.fn(), onFailure);
    fail(1);

    expect(onFailure).toHaveBeenCalledWith('denied');
  });

  it('reports a failure where geolocation is missing', () => {
    vi.stubGlobal('navigator', {});
    const onPosition = vi.fn();
    const onFailure = vi.fn();

    expect(() => requestCurrentPosition(onPosition, onFailure)()).not.toThrow();
    expect(onPosition).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith('unsupported');
  });
});
